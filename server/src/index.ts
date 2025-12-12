import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { Hono } from 'hono';
import { streamHandle } from 'hono/aws-lambda';
import { streamText } from 'hono/streaming';

const TEST_STREAM_DURATION_SECONDS = 60;

const client = new BedrockAgentCoreClient({});

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/api', async (c) => {
  const body = await c.req.text();
  const sessionId = crypto.randomUUID();

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: process.env.AGENT_RUNTIME_ARN,
    runtimeSessionId: sessionId,
    payload: new TextEncoder().encode(body),
    contentType: 'application/json',
    accept: 'text/event-stream',
  });

  return streamText(c, async (stream) => {
    const response = await client.send(command);
    if (response.response) {
      const responseText = await response.response.transformToString();
      await stream.write(responseText);
    }
  });
});

// APIGatewayのストリーミングが正しく動作するか検証用
app.get('/health-stream', async (c) => {
  return streamText(c, async (stream) => {
    for (let i = 0; i <= TEST_STREAM_DURATION_SECONDS; i++) {
      await stream.writeln(`${i}`);

      await stream.sleep(1000); // 1秒待機
    }
  });
});

export const handler = streamHandle(app);
