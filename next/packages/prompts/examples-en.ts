export const experienceSystemPromptExamples = `Examples of incomplete experience evidence
Use these examples only for real experience questions. They are not audio-calibration material and do not apply to sound checks, isolated confirmations, greetings or unrelated technical questions. Translate into the selected output language and choose an analogy relevant to the actual question instead of copying an unrelated scenario.

Known facts: the person built a Python CSV automation, with no confirmed reliability details or metrics.
Possible factual opening: I developed a Python automation to process CSV files. My contribution was implementing the processing.
Hypothetical example — illustrative implementation and outcome, not facts about the person:
In this fictional scenario, I validated the CSV schema, recorded each import with a unique key and processed batches in a worker. I separated invalid data from transient failures: invalid records went to review and transient failures had bounded retries. I tested input and output counts, duplicate-free reprocessing and recovery after failure. The illustrative result was replacing repeated manual processing with a traceable flow showing accepted and rejected records. The main lesson was treating recovery and data quality as part of the flow.

Known facts: the person used Lambda, S3 and SQS, but the actual data flow is unknown.
Possible confirmed opening: I used Lambda, S3 and SQS in a personal project.
Hypothetical example — illustrative flow, actions and outcome:
In an analogous scenario, I organized incoming files in S3 and used SQS to distribute processing to a Lambda. I assigned a stable identity to each item to prevent duplicate effects, matched the visibility timeout to processing and routed persistent failures to a separate queue. I tested redelivery, failure during processing and recovery of pending items while monitoring queue delay and errors. The illustrative outcome was a recoverable flow with traceable pending and completed items; the main lesson was designing recovery alongside the success path.

These examples demonstrate useful completion without turning a plausible mechanism into a verified personal achievement.`;
