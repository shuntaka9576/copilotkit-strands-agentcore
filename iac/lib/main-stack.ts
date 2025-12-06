import path from "node:path";
import { fileURLToPath } from "node:url";
import * as agentcore from "@aws-cdk/aws-bedrock-agentcore-alpha";
import * as cdk from "aws-cdk-lib";
import { CfnOutput, Duration, Fn } from "aws-cdk-lib";
import {
	type CfnMethod,
	EndpointType,
	LambdaIntegration,
	RestApi,
} from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

export class MainStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);
		const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromAsset(
			path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
		);

		const agentCoreRuntime = new agentcore.Runtime(this, "MyAgentRuntime", {
			runtimeName: "myAgent",
			agentRuntimeArtifact: agentRuntimeArtifact,
		});

		agentCoreRuntime.role.addToPrincipalPolicy(
			new iam.PolicyStatement({
				actions: [
					"bedrock:InvokeModel",
					"bedrock:InvokeModelWithResponseStream",
				],
				resources: ["*"],
			}),
		);

		const server = new NodejsFunction(this, "Server", {
			entry: "../server/src/index.ts",
			handler: "handler",
			runtime: Runtime.NODEJS_24_X,
			timeout: Duration.minutes(15),
			memorySize: 256,
			bundling: {
				format: OutputFormat.ESM,
				minify: true,
			},
			environment: {
				AGENT_RUNTIME_ARN: agentCoreRuntime.agentRuntimeArn,
			},
		});

		// AgentCore Runtime を呼び出す権限を付与
		server.addToRolePolicy(
			new iam.PolicyStatement({
				actions: ["bedrock-agentcore:InvokeAgentRuntime"],
				resources: ["*"],
			}),
		);

		const restApi = new RestApi(this, "RestApi", {
			endpointTypes: [EndpointType.REGIONAL],
			deployOptions: {
				stageName: "v1",
			},
		});

		const lambdaIntegration = new LambdaIntegration(server);
		const rootMethod = restApi.root.addMethod("ANY", lambdaIntegration);
		const proxyMethod = restApi.root
			.addResource("{proxy+}")
			.addMethod("ANY", lambdaIntegration);

		// ストリーミング対応の設定（CloudFormationオーバーライド）
		[rootMethod, proxyMethod].forEach((method) => {
			const cfnMethod = method.node.defaultChild as CfnMethod;
			cfnMethod.addOverride(
				"Properties.Integration.ResponseTransferMode",
				"STREAM",
			);
			cfnMethod.addOverride("Properties.Integration.TimeoutInMillis", 900000);
			cfnMethod.addOverride(
				"Properties.Integration.Uri",
				Fn.sub(
					"arn:aws:apigateway:${AWS::Region}:lambda:path/2021-11-15/functions/${LambdaArn}/response-streaming-invocations",
					{ LambdaArn: server.functionArn },
				),
			);
		});

		new CfnOutput(this, "RestApiUrl", {
			value: restApi.url,
		});
	}
}
