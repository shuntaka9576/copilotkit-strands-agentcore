"""Human in the Loop example for AWS Strands.

This example demonstrates how to create a Strands agent with a generate_task_steps tool
for human-in-the-loop interactions, where users can review and approve task steps before execution.
"""

from typing import List, Literal

from pydantic import BaseModel, Field
from strands import Agent, tool
from strands.models import BedrockModel
from ag_ui_strands import StrandsAgent, create_strands_app


class Step(BaseModel):
    """A single step in a task plan."""

    description: str = Field(
        ...,
        description="A brief description of the step in imperative form",
    )
    status: Literal["enabled", "disabled"] = Field(
        default="enabled",
        description="The status of the step",
    )
    image_url: str | None = Field(
        default=None,
        description="Optional image URL to display with the step",
    )


@tool
def generate_task_steps(
    steps: List[Step],
) -> str:
    """ユーザーがレビューして承認するためのステップリストを生成します。

    このツールは、ユーザーがレビューするためのタスク計画を作成します。
    ユーザーは実行を確認する前にステップを有効/無効にすることができます。
    ユーザーは計画を承認または却下できます。その結果はJSONオブジェクトとして返されます。
    - 却下された場合: `{ accepted: false }`
    - 承認された場合: `{ accepted: true, steps: [{承認されたステップ}] }`

    承認されたステップのリストが返されますが、元のリスト全体ではない場合があります。

    Args:
        steps: 10個のステップオブジェクトのリスト。各オブジェクトには説明とステータスが含まれます。
               各ステップは簡潔（数語）で、命令形である必要があります
               （例：「穴を掘る」「ドアを開ける」「材料を混ぜる」）。

    Returns:
        確認メッセージ。
    """
    return f"{len(steps)}個のステップをユーザーレビュー用に生成しました"


model = BedrockModel(
    model_id="jp.anthropic.claude-haiku-4-5-20251001-v1:0",
    region_name="ap-northeast-1",
)

strands_agent = Agent(
    model=model,
    tools=[generate_task_steps],
    system_prompt="""あなたは明確で実行可能なステップバイステップの計画を作成するタスク計画アシスタントです。
必ず日本語で回答してください。

**あなたの主な役割:**
- ユーザーのリクエストを正確に10個の明確で実行可能なステップに分解する
- ユーザーのレビューと承認が必要なステップを生成する
- ユーザーが承認したステップのみを実行する

**ユーザーがタスクのヘルプをリクエストした場合:**
1. 必ず`generate_task_steps`ツールを使用して分解を作成する（特に指定がない限り10ステップ）
2. 各ステップは:
   - 簡潔（数語のみ）
   - 命令形（例：「穴を掘る」「ドアを開ける」「材料を混ぜる」）
   - 明確で実行可能
   - 最初から最後まで論理的に順序付けられている
3. 初期状態ではすべてのステップを「enabled」に設定
4. ユーザーが計画をレビューした後:
   - 承認された場合: 計画を簡潔に確認し（承認されたステップのみ含む）、進める（ステップを繰り返さない）。追加の確認情報を求めない。
   - 拒否された場合: 変更したい点を尋ねる（ユーザーの入力があるまでgenerate_task_stepsを再度呼び出さない）
5. ユーザーが計画を承認したら、承認されたステップを順番に実行したかのように繰り返して「実行」する。その後、計画が完了したことをユーザーに知らせる。
    - 例：ユーザーが「穴を掘る」「ドアを開ける」「材料を混ぜる」のステップを承認した場合、「穴を掘っています... ドアを開けています... 材料を混ぜています...」と回答する

**重要:**
- ユーザーの入力なしに`generate_task_steps`を連続して2回呼び出さない
- ツールを呼び出した後、回答でステップのリストを繰り返さない
- 承認されたステップをどのように実行するかの簡潔で創造的な要約を提供する

**画像について:**
- 各ステップにはオプションで画像URLを含めることができる
- テスト用に以下のダミー画像URLを使用: https://picsum.photos/200/100?random=N（Nはステップ番号）
- 例: image_url="https://picsum.photos/200/100?random=1"
""",
)

agui_agent = StrandsAgent(
    agent=strands_agent,
    name="human_in_the_loop",
    description="AWS Strands agent with human-in-the-loop task planning",
)

app = create_strands_app(agui_agent, "/invocations")


@app.get("/ping")
async def ping():
    """Health check endpoint for AWS Bedrock AgentCore."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
