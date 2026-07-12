Submit Image Generation Task — API Reference
Endpoint
Field Value
Method POST
URL https://app-bqosbzxnngu9-api-zYkZzKQJrBdL.gateway.appmedo.com/image-generation/submit
Content-Type application/json
Auth X-Gateway-Authorization: Bearer <key>
Request Parameters
Parameter Type Required Description
contents Array ✅ Input content collection; each element represents one round of input
contents[].parts Array ✅ Content parts for this round; may contain both text and images
contents[].parts[].text String ❌ Prompt text description
contents[].parts[].inline_data Object ❌ Image input object (required for image-to-image)
contents[].parts[].inline_data.mime_type String ✅* Image MIME type: image/png, image/jpeg, or image/webp
contents[].parts[].inline_data.data String ✅* Pure Base64 string (without the data:image/...;base64, prefix)
\*Required when inline_data is present.

Request Limits

Total request size < 20 MB
Supported formats: PNG, JPEG, WEBP
Response Fields
Field Path Type Description
status number 0 = success, 1 = failure
data.taskId string Task ID for subsequent status queries
data.status string Initial status, always "PENDING"
data.estimatedTime number Estimated completion time in seconds
message string? Present only when status=1; error description
Example Response
{
"status": 0,
"data": {
"taskId": "task-1734567890123-abc12345",
"status": "PENDING",
"estimatedTime": 600
}
}
Generation-Time Usage (Agent Direct Call)
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface Part {
text?: string;
inline_data?: { mime_type: string; data: string }; // data: pure Base64, no prefix
}

interface SubmitResponse {
taskId: string;
status: string;
estimatedTime?: number;
}

async function submitTask(parts: Part[]): Promise<SubmitResponse> {
const response = await fetch(
"https://app-bqosbzxnngu9-api-zYkZzKQJrBdL.gateway.appmedo.com/image-generation/submit",
{
method: "POST",
headers: {
"Content-Type": "application/json",
"X-Gateway-Authorization": `Bearer ${apiKey}`,
},
body: JSON.stringify({ contents: [{ parts }] }),
}
);

if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

const json = await response.json();
if (json.status !== 0) throw new Error(`API error: ${json.message}`);

return json.data;
}

// ── Usage examples ──────────────────────────────────────────────

// Text-to-Image
const { taskId } = await submitTask([
{ text: "A cute orange kitten in a sunny garden, cartoon style, high definition" }
]);

// Image-to-Image (style transfer)
// Convert image file to pure Base64 first (Node.js):
// const base64 = fs.readFileSync("photo.png").toString("base64");
const { taskId: taskId2 } = await submitTask([
{ inline_data: { mime_type: "image/png", data: "<pure-base64-string>" } },
{ text: "Convert to cartoon illustration style" }
]);

// Multi-Image composition
const { taskId: taskId3 } = await submitTask([
{ inline_data: { mime_type: "image/png", data: "<base64-image-1>" } },
{ inline_data: { mime_type: "image/jpeg", data: "<base64-image-2>" } },
{ text: "Compose the person from image 1 into the scenery of image 2, natural and harmonious" }
]);
