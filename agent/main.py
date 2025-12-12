"""Video Analysis Agent for AWS Strands.

This example demonstrates how to create a Strands agent with a extract_video_frames tool
for human-in-the-loop interactions, where users can review and select video frames for analysis.
"""

import logging
import os
from typing import List, Literal

from pydantic import BaseModel, Field
from strands import Agent, tool
from strands.models import BedrockModel
from ag_ui_strands import StrandsAgent, create_strands_app

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Frame(BaseModel):
    """動画内の単一フレーム。"""

    description: str = Field(
        ...,
        description="フレームの簡潔な説明",
    )
    status: Literal["enabled", "disabled"] = Field(
        default="enabled",
        description="フレームの選択状態",
    )
    timestamp: str = Field(
        ...,
        description="フレームのタイムスタンプ（例: 00:01:23）",
    )
    image_url: str | None = Field(
        default=None,
        description="フレームの画像URL",
    )


@tool
def extract_video_frames(
    frames: List[Frame],
) -> str:
    """動画からフレームを抽出し、ユーザーに選択させます。

    このツールは、動画から抽出したフレームのリストを作成し、ユーザーにレビューさせます。
    ユーザーは分析したいフレームを選択できます。
    ユーザーは選択を承認または却下できます。その結果はJSONオブジェクトとして返されます。
    - 却下された場合: `{ accepted: false }`
    - 承認された場合: `{ accepted: true, frames: [{選択されたフレーム}] }`

    選択されたフレームのリストが返されますが、元のリスト全体ではない場合があります。

    Args:
        frames: フレームオブジェクトのリスト。各オブジェクトには説明、タイムスタンプ、画像URLが含まれます。

    Returns:
        確認メッセージ。
    """
    logger.info(f"抽出されたフレーム数: {len(frames)}")
    for i, frame in enumerate(frames):
        logger.info(f"  フレーム {i+1}: {frame.timestamp} - {frame.description}")
    return f"{len(frames)}個のフレームを抽出しました。ユーザーの選択をお待ちください。"


def log_selected_frames(frames: List[dict]) -> None:
    """選択されたフレームをログに記録します。"""
    logger.info("=" * 50)
    logger.info("ユーザーが選択したフレーム:")
    logger.info("=" * 50)
    for i, frame in enumerate(frames):
        logger.info(f"  [{i+1}] {frame.get('timestamp', 'N/A')} - {frame.get('description', 'N/A')}")
    logger.info("=" * 50)


model = BedrockModel(
    model_id="jp.anthropic.claude-haiku-4-5-20251001-v1:0",
    region_name="ap-northeast-1",
)

# モック用プロンプト（動画ファイル不要、タイトルから推測）
MOCK_SYSTEM_PROMPT = """あなたは動画を解析し、重要なフレームを抽出する動画解析アシスタントです。
必ず日本語で回答してください。

**あなたの主な役割:**
- ユーザーが指定した動画の内容を分析する
- 動画から重要なシーンやフレームを抽出する
- ユーザーが分析したいフレームを選択できるようにする

**ユーザーが動画に「タグをつける」または動画解析をリクエストした場合:**
1. 動画ファイルの実際のパスやURLは不要です。動画のタイトルから内容を推測してください。
2. 必ず`extract_video_frames`ツールを使用してフレームを抽出する
3. 6個のフレームを生成してください
4. 各フレームには:
   - 動画タイトルから推測した簡潔な説明（何が映っているか）
   - タイムスタンプ（例: 00:01:23）
   - 画像URL（テスト用のダミー画像を使用）
5. 初期状態ではすべてのフレームを「enabled」（選択済み）に設定
6. ユーザーがフレームをレビューした後:
   - 承認された場合: 選択されたフレームについてタグを提案
   - 拒否された場合: 何を変更したいか尋ねる

**重要:**
- 動画ファイルへのアクセス情報は求めないでください。タイトルから推測して即座にフレームを生成してください。
- ユーザーの入力なしに`extract_video_frames`を連続して2回呼び出さない
- ツールを呼び出した後、回答でフレームのリストを繰り返さない

**画像URLについて:**
- テスト用に以下のダミー画像URLを使用: https://picsum.photos/400/225?random=N（Nはフレーム番号）
- 例: image_url="https://picsum.photos/400/225?random=1"

**タイムスタンプの形式:**
- HH:MM:SS形式で指定（例: 00:01:23）
- 5分程度の動画を想定し、適切な間隔でフレームを抽出する
"""

# 本番用プロンプト（実際の動画ファイル情報が必要）
PRODUCTION_SYSTEM_PROMPT = """あなたは動画を解析し、重要なフレームを抽出する動画解析アシスタントです。
必ず日本語で回答してください。

**あなたの主な役割:**
- ユーザーが指定した動画の内容を分析する
- 動画から重要なシーンやフレームを抽出する
- ユーザーが分析したいフレームを選択できるようにする

**ユーザーが動画解析をリクエストした場合:**
1. 動画ファイルのパス、URL、またはIDを確認してください
2. 必要な情報が不足している場合は、ユーザーに以下を尋ねてください:
   - 動画ファイルのパスまたはURL
   - 抽出したいフレームの条件（オプション）
   - 動画の長さ（オプション）
3. 情報が揃ったら`extract_video_frames`ツールを使用してフレームを抽出する
4. 各フレームには:
   - 簡潔な説明（何が映っているか）
   - タイムスタンプ（例: 00:01:23）
   - 画像URL
5. 初期状態ではすべてのフレームを「enabled」（選択済み）に設定し、ユーザーに除外するフレームを選ばせる
6. ユーザーがフレームをレビューした後:
   - 承認された場合: 選択されたフレームについて詳細な分析を提供
   - 拒否された場合: 何を変更したいか尋ねる

**重要:**
- ユーザーの入力なしに`extract_video_frames`を連続して2回呼び出さない
- ツールを呼び出した後、回答でフレームのリストを繰り返さない
- 選択されたフレームについて簡潔で有益な分析を提供する

**タイムスタンプの形式:**
- HH:MM:SS形式で指定（例: 00:01:23）
- 動画の長さに応じて適切な間隔でフレームを抽出する
"""

# 環境変数でプロンプトを切り替え（MOCK_MODE=true でモック用）
USE_MOCK = os.getenv("MOCK_MODE", "false").lower() == "true"
system_prompt = MOCK_SYSTEM_PROMPT if USE_MOCK else PRODUCTION_SYSTEM_PROMPT
logger.info(f"Using {'MOCK' if USE_MOCK else 'PRODUCTION'} system prompt")

strands_agent = Agent(
    model=model,
    tools=[extract_video_frames],
    system_prompt=system_prompt,
)

agui_agent = StrandsAgent(
    agent=strands_agent,
    name="video_analyzer",
    description="AWS Strands agent for video frame analysis with human-in-the-loop selection",
)

app = create_strands_app(agui_agent, "/invocations")


@app.get("/ping")
async def ping():
    """Health check endpoint for AWS Bedrock AgentCore."""
    return {"status": "healthy"}


@app.post("/log_selected_frames")
async def log_frames(data: dict):
    """選択されたフレームをログに記録するエンドポイント。"""
    frames = data.get("frames", [])
    log_selected_frames(frames)
    return {"status": "logged", "frame_count": len(frames)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
