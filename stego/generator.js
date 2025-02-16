#!/usr/bin/env bun

import { writeFileSync, existsSync } from "fs"
import { Jimp } from "jimp"

console.log("Script started")

// ---------------------------
// KEY GENERATION FUNCTIONS
// ---------------------------
async function generateKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-512"
    },
    true,
    ["sign", "verify"]
  )
}

async function exportPublicKeyAsPEM(publicKey) {
  const exported = await crypto.subtle.exportKey("spki", publicKey)
  const exportedAsString = Buffer.from(exported).toString("base64")
  // Add proper line breaks every 64 characters
  const formattedKey = exportedAsString.match(/.{1,64}/g).join("\n")
  return `-----BEGIN PUBLIC KEY-----\n${formattedKey}\n-----END PUBLIC KEY-----`
}

async function exportPrivateKeyAsPEM(privateKey) {
  const exported = await crypto.subtle.exportKey("pkcs8", privateKey)
  const exportedAsString = Buffer.from(exported).toString("base64")
  // Add proper line breaks every 64 characters
  const formattedKey = exportedAsString.match(/.{1,64}/g).join("\n")
  return `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`
}

// ---------------------------
// STEGANOGRAPHY FUNCTIONS
// ---------------------------
function int32ToBits(num) {
  const bits = []
  for (let i = 0; i < 32; i++) {
    bits.push((num >> (31 - i)) & 1)
  }
  return bits
}

function embedMessageInImage(image, message) {
  const messageBuffer = Buffer.from(message, "utf8")
  const msgLength = messageBuffer.length
  const lengthBits = int32ToBits(msgLength)
  const messageBits = []
  for (const byte of messageBuffer) {
    for (let bit = 7; bit >= 0; bit--) {
      messageBits.push((byte >> bit) & 1)
    }
  }
  const totalBits = lengthBits.concat(messageBits)
  const capacity = image.bitmap.width * image.bitmap.height * 3
  if (totalBits.length > capacity) {
    throw new Error("Message too large for this image")
  }
  let bitIndex = 0
  const data = image.bitmap.data
  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      if (bitIndex < totalBits.length) {
        data[i + channel] = (data[i + channel] & 0xfe) | totalBits[bitIndex]
        bitIndex++
      } else {
        break
      }
    }
    if (bitIndex >= totalBits.length) break
  }
  return image
}

// ---------------------------
// MAIN FUNCTION
// ---------------------------
async function main() {
  const args = process.argv.slice(2)
  if (args.length < 3) {
    console.error("Usage: bun run generator.js <inputImage.png> <outputImage.png> <outputHTML.html>")
    process.exit(1)
  }
  const [inputImagePath, outputImagePath, outputHTMLPath] = args

  console.log("Generating key pair...")
  const keyPair = await generateKeyPair()
  const publicKeyPem = await exportPublicKeyAsPEM(keyPair.publicKey)
  const privateKeyPem = await exportPrivateKeyAsPEM(keyPair.privateKey)

  console.log("Loading input image...")
  const image = await Jimp.read(inputImagePath)

  console.log("Creating spirit.json...")
  const spiritJson = JSON.stringify({ pem: privateKeyPem }, null, 2)

  console.log("Embedding spirit.json into image...")
  embedMessageInImage(image, spiritJson)

  console.log("Writing stego image...")
  image.write(outputImagePath)
  console.log("Stego image written to", outputImagePath)

  // In the meta tag we replace newlines with the literal "\n"
  const metaKey = publicKeyPem.replace(/\n/g, '\\n')

  // Build the HTML output using String.raw so that escape sequences are preserved exactly.
  const htmlContent = String.raw`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Stego Key Verification</title>
  <meta name="public-key" content="` + metaKey + String.raw`">
  <style>
    body { font-family: sans-serif; margin: 20px; background: #f8f8f8; }
    .container { max-width: 800px; margin: auto; background: #fff; padding: 20px;
                 border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
    img { max-width: 100%; height: auto; border: 1px solid #ccc; margin-bottom: 1em; }
    button { margin: 5px; padding: 10px 15px; font-size: 1rem; }
    #result { margin-top: 1em; padding: 1em; border-radius: 4px; }
    .success { background: #e6ffe6; color: #006600; }
    .error { background: #ffe6e6; color: #660000; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Stego Key Verification</h1>
    <p>This page holds a public key. Click the button below to load the stego image and extract the private key.</p>
    <button id="loadImageBtn">Load Stego Image</button>
    <input type="file" id="imageInput" accept="image/png" style="display:none">
    <div id="imageContainer"></div>
    <div id="result"></div>
  </div>
  <script>
    function extractMessageFromImageData(imageData) {
      const data = imageData.data;
      const bits = [];
      for (let i = 0; i < data.length; i += 4) {
        for (let j = 0; j < 3; j++) {
          bits.push(data[i + j] & 1);
        }
      }
      let msgLength = 0;
      for (let i = 0; i < 32; i++) {
        msgLength = (msgLength << 1) | bits[i];
      }
      console.log("Extracted message length:", msgLength);
      if (msgLength <= 0 || msgLength > (bits.length - 32) / 8) {
        throw new Error("Invalid message length");
      }
      const messageBytes = new Uint8Array(msgLength);
      for (let i = 0; i < msgLength; i++) {
        let byte = 0;
        for (let j = 0; j < 8; j++) {
          byte = (byte << 1) | bits[32 + i * 8 + j];
        }
        messageBytes[i] = byte;
      }
      return new TextDecoder().decode(messageBytes);
    }
    
    async function importPrivateKey(pem) {
      try {
        // Convert any escaped newline sequences (literal "\n") into actual newlines
        pem = pem.replace(/\\n/g, '\n');
        const pemHeader = "-----BEGIN PRIVATE KEY-----";
        const pemFooter = "-----END PRIVATE KEY-----";
        let pemContents = pem.trim();
        if (pemContents.includes(pemHeader)) {
          pemContents = pemContents.replace(pemHeader, "");
        }
        if (pemContents.includes(pemFooter)) {
          pemContents = pemContents.replace(pemFooter, "");
        }
        pemContents = pemContents.replace(/\s+/g, "");
        const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
        return await crypto.subtle.importKey(
          "pkcs8",
          binaryDer,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
          true,
          ["sign"]
        );
      } catch (error) {
        console.error("Private key import error:", error);
        throw error;
      }
    }
    
    async function importPublicKey(pem) {
      try {
        // Convert any escaped newline sequences (literal "\n") into actual newlines
        pem = pem.replace(/\\n/g, '\n');
        const pemHeader = "-----BEGIN PUBLIC KEY-----";
        const pemFooter = "-----END PUBLIC KEY-----";
        let pemContents = pem.trim();
        if (pemContents.includes(pemHeader)) {
          pemContents = pemContents.replace(pemHeader, "");
        }
        if (pemContents.includes(pemFooter)) {
          pemContents = pemContents.replace(pemFooter, "");
        }
        pemContents = pemContents.replace(/\s+/g, "");
        const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
        return await crypto.subtle.importKey(
          "spki",
          binaryDer,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
          true,
          ["verify"]
        );
      } catch (error) {
        console.error("Public key import error:", error);
        console.error("Failed base64:", pem);
        throw error;
      }
    }
    
    async function verifyKeyPair(privateKey, publicKeyPem) {
      try {
        const testMessage = new TextEncoder().encode("test");
        const signature = await crypto.subtle.sign(
          { name: "RSASSA-PKCS1-v1_5" },
          privateKey,
          testMessage
        );
        const pubKey = await importPublicKey(publicKeyPem);
        return await crypto.subtle.verify(
          { name: "RSASSA-PKCS1-v1_5" },
          pubKey,
          signature,
          testMessage
        );
      } catch (error) {
        console.error("Verification error:", error);
        throw error;
      }
    }
    
    document.getElementById("loadImageBtn").addEventListener("click", () => {
      document.getElementById("imageInput").click();
    });
    
    document.getElementById("imageInput").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      const resultDiv = document.getElementById("result");
      resultDiv.className = "";
      resultDiv.innerText = "Processing...";
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const img = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = dataUrl;
        });
        document.getElementById("imageContainer").innerHTML = "";
        document.getElementById("imageContainer").appendChild(img);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        img.style.width = "50%";
        img.style.height = "auto";
        const extracted = extractMessageFromImageData(imageData);
        console.log("Extracted data length:", extracted.length);
        const keyData = JSON.parse(extracted);
        console.log("Extracted key data:", keyData);
        const privateKey = await importPrivateKey(keyData.pem);
        const publicKeyPem = document.querySelector('meta[name="public-key"]').content;
        const valid = await verifyKeyPair(privateKey, publicKeyPem);
        resultDiv.innerText = valid ? "Key pair verified successfully!" : "Key pair verification failed";
        resultDiv.className = valid ? "success" : "error";
      } catch (error) {
        console.error("Processing error:", error);
        resultDiv.innerText = "Error: " + error.message;
        resultDiv.className = "error";
      }
    });
  </script>
</body>
</html>`

  console.log("Writing HTML file...")
  writeFileSync(outputHTMLPath, htmlContent, "utf8")
  console.log("HTML file written to", outputHTMLPath)

  if (existsSync(outputHTMLPath)) {
    console.log("Confirmed: File exists at", outputHTMLPath)
  } else {
    console.error("Error: HTML file does not exist at", outputHTMLPath)
  }
}

main().catch(err => {
  console.error("Error:", err)
  process.exit(1)
})
