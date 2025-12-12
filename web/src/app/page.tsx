"use client";
import React, { useState, useEffect } from "react";
import "@copilotkit/react-ui/styles.css";
import { useHumanInTheLoop, useLangGraphInterrupt } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { useTheme } from "next-themes";


interface Frame {
  description: string;
  status: "disabled" | "enabled" | "executing";
  timestamp: string;
  image_url?: string;
}

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

  const handleConfirm = async () => {
    if (respond) {
      const selectedFrames = localFrames.filter((frame) => frame.status === "enabled");
      setAccepted(true);

      // サーバーにログを送信
      try {
        await fetch("http://localhost:8080/log_selected_frames", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ frames: selectedFrames }),
        });
      } catch (error) {
        console.error("ログ送信エラー:", error);
      }

      respond({ accepted: true, frames: selectedFrames });
    }
  };

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

      {/* Action Buttons */}
      {accepted === null && (
        <div className="flex justify-end gap-3">
          <ActionButton variant="secondary" theme={theme} onClick={handleReject} disabled={!respond}>
            キャンセル
          </ActionButton>
          <ActionButton variant="primary" theme={theme} onClick={handleConfirm} disabled={!respond}>
            {respond ? "解析実行" : "準備中..."}
          </ActionButton>
        </div>
      )}

      {/* Result State */}
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
            {accepted ? "解析実行中..." : "キャンセルしました"}
          </div>
        </div>
      )}
    </FrameContainer>
  );
};

export default function Page() {
  return <Chat />;
}
