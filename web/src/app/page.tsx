"use client";
import React, { useState, useEffect, createContext, useContext } from "react";
import "@copilotkit/react-ui/styles.css";
import { useHumanInTheLoop, useLangGraphInterrupt, useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";
import { CopilotChat } from "@copilotkit/react-ui";
import { useTheme } from "next-themes";

interface Frame {
  description: string;
  status: "disabled" | "enabled" | "executing";
  timestamp: string;
  image_url?: string;
}

interface Tag {
  name: string;
  selected: boolean;
}

// 動画の型定義
interface Video {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  tags: string[];
}

// 選択状態のContext
const SelectedVideoContext = createContext<{
  selectedVideo: Video | null;
  setSelectedVideo: React.Dispatch<React.SetStateAction<Video | null>>;
} | null>(null);

const useSelectedVideo = () => {
  const context = useContext(SelectedVideoContext);
  if (!context) {
    throw new Error("useSelectedVideo must be used within SelectedVideoProvider");
  }
  return context;
};

// Shared UI Components
const FrameContainer = ({ theme, children }: { theme?: string; children: React.ReactNode }) => (
  <div data-testid="select-frames" className="flex">
    <div
      className={`rounded-lg w-[800px] p-5 ${
        theme === "dark"
          ? "bg-slate-800 text-white border border-slate-600"
          : "bg-white text-gray-800 border border-gray-300"
      }`}
    >
      {children}
    </div>
  </div>
);

const FrameHeader = ({
  theme,
  enabledCount,
  totalCount,
}: {
  theme?: string;
  enabledCount: number;
  totalCount: number;
}) => (
  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-300 dark:border-slate-600">
    <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
      除外するフレームを選択
    </h2>
    <div className={`text-sm font-medium ${theme === "dark" ? "text-slate-300" : "text-gray-600"}`}>
      解析対象: {enabledCount} / {totalCount}
    </div>
  </div>
);

const FrameItem = ({
  frame,
  theme,
  onToggle,
}: {
  frame: { description: string; status: string; timestamp: string; image_url?: string };
  theme?: string;
  onToggle: () => void;
}) => (
  <div
    data-testid="frame-item"
    className={`relative rounded overflow-hidden cursor-pointer border-2 transition-colors ${
      frame.status === "enabled"
        ? "border-blue-500"
        : theme === "dark"
          ? "border-slate-600 opacity-50"
          : "border-gray-300 opacity-50"
    }`}
    onClick={onToggle}
  >
    <div className="aspect-video w-full overflow-hidden">
      <img
        src={frame.image_url || `https://picsum.photos/seed/${encodeURIComponent(frame.timestamp)}/400/225`}
        alt={frame.timestamp}
        className="w-full h-full object-cover"
      />
    </div>
    {/* タイムスタンプ */}
    <div className={`px-2 py-1 text-xs font-mono text-center ${
      theme === "dark" ? "bg-slate-700 text-slate-200" : "bg-gray-100 text-gray-700"
    }`}>
      {frame.timestamp}
    </div>
    {/* 除外マーク */}
    {frame.status !== "enabled" && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-white text-gray-600"
        }`}>
          除外
        </div>
      </div>
    )}
  </div>
);

const ActionButton = ({
  variant,
  theme,
  onClick,
  disabled = false,
  children,
}: {
  variant: "primary" | "secondary";
  theme?: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) => {
  const baseClasses = "px-5 py-2 rounded font-medium text-sm transition-colors";

  const variantClasses = {
    primary:
      theme === "dark"
        ? "bg-blue-600 hover:bg-blue-700 text-white"
        : "bg-blue-600 hover:bg-blue-700 text-white",
    secondary:
      theme === "dark"
        ? "bg-slate-600 hover:bg-slate-500 text-white"
        : "bg-gray-200 hover:bg-gray-300 text-gray-700",
  };

  const disabledClasses = "opacity-50 cursor-not-allowed";

  return (
    <button
      className={`${baseClasses} ${disabled ? disabledClasses : variantClasses[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
const InterruptHumanInTheLoop: React.FC<{
  event: { value: { frames: Frame[] } };
  resolve: (value: string) => void;
}> = ({ event, resolve }) => {
  const { theme } = useTheme();

  // Parse and initialize frames data
  let initialFrames: Frame[] = [];
  if (event.value && event.value.frames && Array.isArray(event.value.frames)) {
    initialFrames = event.value.frames.map((frame: any) => ({
      description: typeof frame === "string" ? frame : frame.description || "",
      status: typeof frame === "object" && frame.status ? frame.status : "enabled",
      timestamp: typeof frame === "object" && frame.timestamp ? frame.timestamp : "00:00:00",
    }));
  }

  const [localFrames, setLocalFrames] = useState<Frame[]>(initialFrames);
  const enabledCount = localFrames.filter((frame) => frame.status === "enabled").length;

  const handleFrameToggle = (index: number) => {
    setLocalFrames((prevFrames) =>
      prevFrames.map((frame, i) =>
        i === index
          ? { ...frame, status: frame.status === "enabled" ? "disabled" : "enabled" }
          : frame,
      ),
    );
  };

  const handleAnalyzeFrames = () => {
    const selectedFrames = localFrames
      .filter((frame) => frame.status === "enabled")
      .map((frame) => `${frame.timestamp}: ${frame.description}`);
    resolve("ユーザーが選択したフレーム: " + selectedFrames.join(", "));
  };

  return (
    <FrameContainer theme={theme}>
      <FrameHeader theme={theme} enabledCount={enabledCount} totalCount={localFrames.length} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {localFrames.map((frame, index) => (
          <FrameItem
            key={index}
            frame={frame}
            theme={theme}
            onToggle={() => handleFrameToggle(index)}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <ActionButton variant="primary" theme={theme} onClick={handleAnalyzeFrames}>
          解析実行
        </ActionButton>
      </div>
    </FrameContainer>
  );
};

const Chat = () => {
  useLangGraphInterrupt({
    render: ({ event, resolve }) => <InterruptHumanInTheLoop event={event} resolve={resolve} />,
  });
  useHumanInTheLoop({
    name: "extract_video_frames",
    description: "動画からフレームを抽出し、ユーザーに選択させます",
    parameters: [
      {
        name: "frames",
        type: "object[]",
        attributes: [
          {
            name: "description",
            type: "string",
          },
          {
            name: "status",
            type: "string",
            enum: ["enabled", "disabled", "executing"],
          },
          {
            name: "timestamp",
            type: "string",
          },
          {
            name: "image_url",
            type: "string",
          },
        ],
      },
    ],
    available: "enabled",
    render: ({ args, respond, status }) => {
      return <FramesFeedback args={args} respond={respond} status={status} />;
    },
  });

  return (
    <div className="flex justify-center items-center h-full w-full">
      <div className="h-full w-full md:w-8/10 md:h-8/10 rounded-lg">
        <CopilotChat
          suggestions={[
            { title: "製造ライン点検", message: "製造ラインの点検動画を解析して、チェックポイントを6フレーム抽出してください" },
            { title: "組立工程", message: "組立工程の動画を解析して、重要な作業手順を9フレーム抽出してください" },
          ]}
          className="h-full rounded-2xl max-w-6xl mx-auto"
          labels={{
            initial:
              "こんにちは！動画解析アシスタントです。動画の重要なフレームを抽出し、分析するお手伝いをします。",
          }}
        />
      </div>
    </div>
  );
};

const FramesFeedback = ({ args, respond, status }: { args: any; respond: any; status: any }) => {
  const { theme } = useTheme();
  const [localFrames, setLocalFrames] = useState<Frame[]>([]);
  const [step, setStep] = useState<"frames" | "tags" | "done">("frames");
  const [localTags, setLocalTags] = useState<Tag[]>([]);
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    if (args.frames && args.frames.length > 0 && localFrames.length === 0) {
      setLocalFrames(args.frames);
    }
  }, [args.frames, localFrames]);

  if (args.frames === undefined || args.frames.length === 0) {
    return <></>;
  }

  const frames = localFrames.length > 0 ? localFrames : args.frames;
  const enabledCount = frames.filter((frame: any) => frame.status === "enabled").length;

  const handleFrameToggle = (index: number) => {
    setLocalFrames((prevFrames) =>
      prevFrames.map((frame, i) =>
        i === index
          ? { ...frame, status: frame.status === "enabled" ? "disabled" : "enabled" }
          : frame,
      ),
    );
  };

  const handleReject = () => {
    if (respond) {
      setAccepted(false);
      respond({ accepted: false });
    }
  };

  // フレーム選択完了 → タグ選択へ
  const handleFrameConfirm = async () => {
    const selectedFrames = localFrames.filter((frame) => frame.status === "enabled");

    // サーバーにログを送信
    try {
      await fetch("http://localhost:8080/log_selected_frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: selectedFrames }),
      });
    } catch (error) {
      console.error("ログ送信エラー:", error);
    }

    // モックのタグ候補を生成（TODO: 実際はLLMで生成）
    const mockTags: Tag[] = [
      { name: "点検作業", selected: true },
      { name: "設備確認", selected: true },
      { name: "安全装備", selected: true },
      { name: "製造ライン", selected: true },
      { name: "品質管理", selected: true },
      { name: "作業記録", selected: true },
      { name: "定期点検", selected: true },
      { name: "異常確認", selected: true },
    ];
    setLocalTags(mockTags);
    setStep("tags");
  };

  const handleTagToggle = (index: number) => {
    setLocalTags((prevTags) =>
      prevTags.map((tag, i) =>
        i === index ? { ...tag, selected: !tag.selected } : tag
      )
    );
  };

  // タグ選択完了 → respond
  const handleTagConfirm = () => {
    if (respond) {
      const selectedFrames = localFrames.filter((frame) => frame.status === "enabled");
      const selectedTags = localTags.filter((tag) => tag.selected);
      setAccepted(true);
      setStep("done");
      respond({ accepted: true, frames: selectedFrames, tags: selectedTags });
    }
  };

  const selectedTagCount = localTags.filter((tag) => tag.selected).length;

  // タグ選択UI
  if (step === "tags") {
    return (
      <div data-testid="select-tags" className="flex">
        <div
          className={`rounded-lg w-[600px] p-5 ${
            theme === "dark"
              ? "bg-slate-800 text-white border border-slate-600"
              : "bg-white text-gray-800 border border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-300 dark:border-slate-600">
            <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
              タグを選択
            </h2>
            <div className={`text-sm font-medium ${theme === "dark" ? "text-slate-300" : "text-gray-600"}`}>
              選択中: {selectedTagCount} / {localTags.length}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {localTags.map((tag, index) => (
              <div
                key={index}
                onClick={() => handleTagToggle(index)}
                className={`relative px-4 py-2 rounded-lg cursor-pointer transition-all border-2 ${
                  tag.selected
                    ? "bg-blue-600 text-white border-blue-500"
                    : theme === "dark"
                      ? "bg-slate-600 text-slate-300 border-slate-500 opacity-50"
                      : "bg-gray-200 text-gray-500 border-gray-300 opacity-50"
                }`}
              >
                <span className="text-sm font-medium">{tag.name}</span>
                {!tag.selected && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-xs px-1 rounded ${
                      theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-white text-gray-600"
                    }`}>
                      除外
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <ActionButton variant="secondary" theme={theme} onClick={handleReject}>
              キャンセル
            </ActionButton>
            <ActionButton variant="primary" theme={theme} onClick={handleTagConfirm}>
              タグを確定
            </ActionButton>
          </div>
        </div>
      </div>
    );
  }

  // 完了UI
  if (step === "done") {
    return (
      <div className="flex">
        <div
          className={`px-4 py-2 rounded text-sm font-medium ${
            accepted
              ? theme === "dark"
                ? "bg-green-800 text-green-100"
                : "bg-green-100 text-green-800"
              : theme === "dark"
                ? "bg-gray-700 text-gray-300"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          {accepted ? "タグを適用しました" : "キャンセルしました"}
        </div>
      </div>
    );
  }

  // フレーム選択UI
  return (
    <FrameContainer theme={theme}>
      <FrameHeader
        theme={theme}
        enabledCount={enabledCount}
        totalCount={frames.length}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {frames.map((frame: any, index: any) => (
          <FrameItem
            key={index}
            frame={frame}
            theme={theme}
            onToggle={() => handleFrameToggle(index)}
          />
        ))}
      </div>

      {accepted === null && (
        <div className="flex justify-end gap-3">
          <ActionButton variant="secondary" theme={theme} onClick={handleReject} disabled={!respond}>
            キャンセル
          </ActionButton>
          <ActionButton variant="primary" theme={theme} onClick={handleFrameConfirm} disabled={!respond}>
            {respond ? "解析実行" : "準備中..."}
          </ActionButton>
        </div>
      )}
    </FrameContainer>
  );
};

// タグ選択UI
const TagsFeedback = ({ args, respond, status }: { args: any; respond: any; status: any }) => {
  const { theme } = useTheme();
  const [localTags, setLocalTags] = useState<Tag[]>([]);
  const [accepted, setAccepted] = useState<boolean | null>(null);

  // デバッグログ
  console.log("TagsFeedback args:", args);
  console.log("TagsFeedback status:", status);

  useEffect(() => {
    if (args.tags && args.tags.length > 0 && localTags.length === 0) {
      setLocalTags(args.tags);
    }
  }, [args.tags, localTags]);

  if (args.tags === undefined || args.tags.length === 0) {
    return <></>;
  }

  const tags = localTags.length > 0 ? localTags : args.tags;
  const selectedCount = tags.filter((tag: Tag) => tag.selected).length;

  const handleTagToggle = (index: number) => {
    setLocalTags((prevTags) =>
      prevTags.map((tag, i) =>
        i === index ? { ...tag, selected: !tag.selected } : tag
      )
    );
  };

  const handleReject = () => {
    if (respond) {
      setAccepted(false);
      respond({ accepted: false });
    }
  };

  const handleConfirm = () => {
    if (respond) {
      const selectedTags = localTags.filter((tag) => tag.selected);
      setAccepted(true);
      respond({ accepted: true, tags: selectedTags });
    }
  };

  return (
    <div data-testid="select-tags" className="flex">
      <div
        className={`rounded-lg w-[600px] p-5 ${
          theme === "dark"
            ? "bg-slate-800 text-white border border-slate-600"
            : "bg-white text-gray-800 border border-gray-300"
        }`}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-300 dark:border-slate-600">
          <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
            タグを選択
          </h2>
          <div className={`text-sm font-medium ${theme === "dark" ? "text-slate-300" : "text-gray-600"}`}>
            選択中: {selectedCount} / {tags.length}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {tags.map((tag: Tag, index: number) => (
            <div
              key={index}
              onClick={() => handleTagToggle(index)}
              className={`relative px-4 py-2 rounded-lg cursor-pointer transition-all border-2 ${
                tag.selected
                  ? "bg-blue-600 text-white border-blue-500"
                  : theme === "dark"
                    ? "bg-slate-600 text-slate-300 border-slate-500 opacity-50"
                    : "bg-gray-200 text-gray-500 border-gray-300 opacity-50"
              }`}
            >
              <span className="text-sm font-medium">{tag.name}</span>
              {!tag.selected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xs px-1 rounded ${
                    theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-white text-gray-600"
                  }`}>
                    除外
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {accepted === null && (
          <div className="flex justify-end gap-3">
            <ActionButton variant="secondary" theme={theme} onClick={handleReject} disabled={!respond}>
              キャンセル
            </ActionButton>
            <ActionButton variant="primary" theme={theme} onClick={handleConfirm} disabled={!respond}>
              {respond ? "タグを確定" : "準備中..."}
            </ActionButton>
          </div>
        )}

        {accepted !== null && (
          <div className="flex justify-end">
            <div
              className={`px-4 py-2 rounded text-sm font-medium ${
                accepted
                  ? theme === "dark"
                    ? "bg-green-800 text-green-100"
                    : "bg-green-100 text-green-800"
                  : theme === "dark"
                    ? "bg-gray-700 text-gray-300"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {accepted ? "タグを適用しました" : "キャンセルしました"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// モック動画データ
const mockVideos: Video[] = [
  { id: "1", title: "製造ライン点検 2024-01-15", thumbnail: "https://picsum.photos/seed/video1/320/180", duration: "05:32", tags: [] },
  { id: "2", title: "組立工程 A-Line", thumbnail: "https://picsum.photos/seed/video2/320/180", duration: "12:45", tags: [] },
  { id: "3", title: "品質検査プロセス", thumbnail: "https://picsum.photos/seed/video3/320/180", duration: "08:20", tags: [] },
  { id: "4", title: "設備メンテナンス記録", thumbnail: "https://picsum.photos/seed/video4/320/180", duration: "15:10", tags: [] },
  { id: "5", title: "安全教育動画", thumbnail: "https://picsum.photos/seed/video5/320/180", duration: "20:00", tags: [] },
];

// 動画一覧テーブル（左パネル）
const VideoTable = () => {
  const { theme } = useTheme();
  const { selectedVideo, setSelectedVideo } = useSelectedVideo();

  return (
    <div className="h-full flex flex-col">
      <h2 className={`text-lg font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
        動画一覧
      </h2>
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className={`text-left text-sm ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
              <th className="pb-2 font-medium">サムネイル</th>
              <th className="pb-2 font-medium">名前</th>
              <th className="pb-2 font-medium">タグ</th>
            </tr>
          </thead>
          <tbody>
            {mockVideos.map((video) => (
              <tr
                key={video.id}
                onClick={() => setSelectedVideo(video)}
                className={`cursor-pointer transition-colors ${
                  selectedVideo?.id === video.id
                    ? theme === "dark"
                      ? "bg-blue-900/50"
                      : "bg-blue-100"
                    : theme === "dark"
                      ? "hover:bg-slate-700"
                      : "hover:bg-gray-100"
                }`}
              >
                <td className="py-2 pr-3">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-20 h-12 object-cover rounded"
                  />
                </td>
                <td className={`py-2 pr-3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  <div className="text-sm font-medium">{video.title}</div>
                  <div className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                    {video.duration}
                  </div>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {video.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-0.5 text-xs rounded ${
                          theme === "dark"
                            ? "bg-slate-600 text-slate-200"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedVideo && (
        <div className={`mt-4 p-3 rounded text-sm ${theme === "dark" ? "bg-slate-700 text-slate-200" : "bg-blue-50 text-blue-800"}`}>
          選択中: {selectedVideo.title}
        </div>
      )}
    </div>
  );
};

// ChatPanel - 右側チャット（入力欄なし、操作ボタンあり）
const ChatPanel = () => {
  const { selectedVideo } = useSelectedVideo();
  const { theme } = useTheme();

  useLangGraphInterrupt({
    render: ({ event, resolve }) => {
      return <InterruptHumanInTheLoop event={event} resolve={resolve} />;
    },
  });

  useHumanInTheLoop({
    name: "select_tags",
    description: "タグ候補を表示し、ユーザーに選択させます",
    parameters: [
      {
        name: "tags",
        type: "object[]",
        attributes: [
          { name: "name", type: "string" },
          { name: "selected", type: "boolean" },
        ],
      },
    ],
    available: "enabled",
    render: ({ args, respond, status }) => {
      console.log("useHumanInTheLoop select_tags render called", { args, status });
      return <TagsFeedback args={args} respond={respond} status={status} />;
    },
  });

  useHumanInTheLoop({
    name: "extract_video_frames",
    description: "動画からフレームを抽出し、ユーザーに選択させます",
    parameters: [
      {
        name: "frames",
        type: "object[]",
        attributes: [
          { name: "description", type: "string" },
          { name: "status", type: "string", enum: ["enabled", "disabled", "executing"] },
          { name: "timestamp", type: "string" },
          { name: "image_url", type: "string" },
        ],
      },
    ],
    available: "enabled",
    render: ({ args, respond, status }) => {
      console.log("useHumanInTheLoop extract_video_frames render called", { args, status });
      return <FramesFeedback args={args} respond={respond} status={status} />;
    },
  });

  const { appendMessage } = useCopilotChat();

  const handleAddTags = () => {
    if (!selectedVideo) return;
    appendMessage(
      new TextMessage({
        role: MessageRole.User,
        content: `「${selectedVideo.title}」の動画にタグをつけてください`,
      })
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* 操作パネル */}
      <div className={`p-4 border-b ${theme === "dark" ? "border-slate-700" : "border-gray-200"}`}>
        {selectedVideo ? (
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                選択中:
              </span>
              <span className={`ml-2 font-medium ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                {selectedVideo.title}
              </span>
            </div>
            <button
              onClick={handleAddTags}
              className="px-4 py-2 text-sm font-medium rounded transition-colors bg-blue-600 hover:bg-blue-700 text-white"
            >
              タグをつける
            </button>
          </div>
        ) : (
          <p className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
            左のパネルから動画を選択してください
          </p>
        )}
      </div>
      {/* チャット表示エリア */}
      <div className="flex-1">
        <CopilotChat
          className="h-full rounded-2xl [&_.copilotKitInput]:hidden"
          labels={{
            initial: "動画を選択して「タグをつける」ボタンを押してください。",
          }}
        />
      </div>
    </div>
  );
};

// 動画テーブル（選択のみ）
const VideoTableWithActions = () => {
  const { theme } = useTheme();
  const { selectedVideo, setSelectedVideo } = useSelectedVideo();

  return (
    <div className="h-full flex flex-col">
      <h2 className={`text-lg font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
        動画一覧
      </h2>
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className={`text-left text-sm ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
              <th className="pb-2 font-medium">サムネイル</th>
              <th className="pb-2 font-medium">名前</th>
              <th className="pb-2 font-medium">タグ</th>
            </tr>
          </thead>
          <tbody>
            {mockVideos.map((video) => (
              <tr
                key={video.id}
                onClick={() => setSelectedVideo(video)}
                className={`cursor-pointer transition-colors ${
                  selectedVideo?.id === video.id
                    ? theme === "dark"
                      ? "bg-blue-900/50"
                      : "bg-blue-100"
                    : theme === "dark"
                      ? "hover:bg-slate-700"
                      : "hover:bg-gray-100"
                }`}
              >
                <td className="py-2 pr-3">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-20 h-12 object-cover rounded"
                  />
                </td>
                <td className={`py-2 pr-3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  <div className="text-sm font-medium">{video.title}</div>
                  <div className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                    {video.duration}
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {video.tags.length > 0 ? (
                      video.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`px-2 py-0.5 text-xs rounded ${
                            theme === "dark"
                              ? "bg-slate-600 text-slate-200"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className={`text-xs ${theme === "dark" ? "text-slate-500" : "text-gray-400"}`}>
                        -
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function Page() {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const { theme } = useTheme();

  return (
    <SelectedVideoContext.Provider value={{ selectedVideo, setSelectedVideo }}>
      <div className="flex h-screen">
        {/* 左側: 動画一覧 */}
        <div className={`w-2/5 p-6 border-r overflow-auto ${theme === "dark" ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-gray-50"}`}>
          <VideoTableWithActions />
        </div>
        {/* 右側: チャット（入力欄なし） */}
        <div className="w-3/5 p-4">
          <ChatPanel />
        </div>
      </div>
    </SelectedVideoContext.Provider>
  );
}
