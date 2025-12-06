import { Hono } from "hono";
import { streamHandle } from "hono/aws-lambda";
import { streamText } from "hono/streaming";

const TEST_STREAM_DURATION_SECONDS = 60;

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/api/chat", (c) => {
	// TODO
	return streamText(c, async (_stream) => {});
});

// APIGatewayのストリーミングが正しく動作するか検証用
app.get("/health-stream", async (c) => {
	return streamText(c, async (stream) => {
		for (let i = 0; i <= TEST_STREAM_DURATION_SECONDS; i++) {
			await stream.writeln(`${i}`);

			await stream.sleep(1000); // 1秒待機
		}
	});
});

export const handler = streamHandle(app);
