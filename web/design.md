# 動画タグ付けアプリケーション設計

## 概要
動画一覧から動画を選択し、AIによるフレーム抽出とタグ付けを行うアプリケーション。

## アーキテクチャ

```
┌──────────────────────┬──────────────────────┐
│   左パネル (40%)      │   右パネル (60%)      │
├──────────────────────┼──────────────────────┤
│                      │ ┌──────────────────┐ │
│   動画一覧テーブル    │ │ 操作パネル        │ │
│   - サムネイル        │ │ 選択中: xxx       │ │
│   - 名前             │ │ [タグをつける]    │ │
│   - タグ             │ └──────────────────┘ │
│                      │                      │
│   クリックで選択      │   CopilotChat        │
│                      │   (入力欄なし)       │
│                      │                      │
│                      │   Human-in-the-Loop  │
│                      │   UI表示エリア       │
└──────────────────────┴──────────────────────┘
```

## フロー

### 1. 動画選択
- 左パネルで動画をクリック
- 右パネルの操作パネルに選択中の動画名が表示
- 「タグをつける」ボタンが有効化

### 2. タグ付けリクエスト
- 「タグをつける」ボタンクリック
- `useCopilotChat`の`appendMessage`でチャットにメッセージ送信
- エージェントが`extract_video_frames`ツールを呼び出し

### 3. フレーム選択（Human-in-the-Loop）
- `useHumanInTheLoop`で`FramesFeedback`コンポーネントをレンダリング
- 6つのフレームをグリッド表示
- クリックで選択/除外をトグル
- 「解析実行」で次のステップへ

### 4. タグ選択
- 同じ`FramesFeedback`コンポーネント内で`step`状態を切り替え
- タグ候補をチップ形式で表示（現在はモック）
- クリックで選択/除外をトグル
- 「タグを確定」で完了

### 5. 完了
- `respond()`を呼び出してエージェントに結果を返す
- 完了メッセージを表示

## 技術的なポイント

### CopilotKit useHumanInTheLoop の制約
- 複数の`useHumanInTheLoop`を同時に定義しても、1つ目しか動作しない
- 解決策: 1つのコンポーネント内で段階的にUIを切り替える（`step`状態）

### 状態管理
- `SelectedVideoContext`: 選択中の動画を共有
- `FramesFeedback`内のローカル状態:
  - `localFrames`: フレームの選択状態
  - `localTags`: タグの選択状態
  - `step`: 現在のステップ（"frames" | "tags" | "done"）

### エージェント側（Strands）
- `extract_video_frames`ツール: フレーム候補を生成
- `select_tags`ツール: 定義はあるがフロントエンドで処理（useHumanInTheLoop制約のため）
- `MOCK_MODE`環境変数でモック/本番切り替え

## ファイル構成

```
web/
├── src/app/
│   └── page.tsx          # メインUI
│       ├── Video型, Frame型, Tag型
│       ├── SelectedVideoContext
│       ├── FramesFeedback    # フレーム選択 + タグ選択
│       ├── VideoTableWithActions
│       ├── ChatPanel
│       └── Page

agent/
└── main.py               # Strandsエージェント
    ├── Frame, Tag (Pydantic)
    ├── extract_video_frames (tool)
    ├── select_tags (tool)
    ├── MOCK_SYSTEM_PROMPT
    └── PRODUCTION_SYSTEM_PROMPT
```

## TODO
- [ ] タグ候補のLLM生成（現在はモック）
- [ ] 選択したタグを左パネルの動画一覧に反映
- [ ] 本番用の動画ファイル解析機能
