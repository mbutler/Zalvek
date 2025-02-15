#!/usr/bin/env bun

import { Jimp } from "jimp"
import { readFileSync } from "fs"

// Extracts the embedded message from an image
function extractMessageFromImage(image) {
  const data = image.bitmap.data
  const bits = []

  // Read LSBs from R, G, B channels of each pixel
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      bits.push(data[i + j] & 1)
    }
  }

  if (bits.length < 32) {
    console.error("Error: Not enough data in the image.")
    process.exit(1)
  }

  // Extract message length (first 32 bits)
  let msgLength = 0
  for (let i = 0; i < 32; i++) {
    msgLength = (msgLength << 1) | bits[i]
  }

  const totalMsgBits = msgLength * 8
  if (bits.length < 32 + totalMsgBits) {
    console.error("Error: Not enough data for the hidden message.")
    process.exit(1)
  }

  // Extract message bytes
  const messageBytes = []
  for (let i = 0; i < msgLength; i++) {
    let byte = 0
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[32 + i * 8 + j]
    }
    messageBytes.push(byte)
  }

  return Buffer.from(messageBytes).toString("utf8")
}

// Convert escaped newlines in PEM to actual newlines
function fixPemFormat(pem) {
  return pem.replace(/\\n/g, "\n").trim()
}

// Import a private key from a PEM string
async function importPrivateKey(pem) {
  try {
    pem = fixPemFormat(pem)

    const pemHeader = "-----BEGIN PRIVATE KEY-----"
    const pemFooter = "-----END PRIVATE KEY-----"
    let pemContents = pem.replace(pemHeader, "").replace(pemFooter, "").replace(/\s+/g, "")

    // Convert base64 to binary
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

    return await crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
      true,
      ["sign"]
    )
  } catch (error) {
    console.error("Private key import error:", error)
    process.exit(1)
  }
}

// Import a public key from a PEM file
async function importPublicKey(filePath) {
  try {
    const pem = fixPemFormat(readFileSync(filePath, "utf8"))

    const pemHeader = "-----BEGIN PUBLIC KEY-----"
    const pemFooter = "-----END PUBLIC KEY-----"
    let pemContents = pem.replace(pemHeader, "").replace(pemFooter, "").replace(/\s+/g, "")

    // Convert base64 to binary
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

    return await crypto.subtle.importKey(
      "spki",
      binaryDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
      true,
      ["verify"]
    )
  } catch (error) {
    console.error("Public key import error:", error)
    process.exit(1)
  }
}

// Verify if the extracted private key matches the given public key
async function verifyKeyPair(privateKey, publicKeyPem) {
  try {
    const testMessage = new TextEncoder().encode("test")
    const signature = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      privateKey,
      testMessage
    )

    const publicKey = await importPublicKey(publicKeyPem)

    const valid = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      publicKey,
      signature,
      testMessage
    )

    return valid
  } catch (error) {
    console.error("Verification error:", error)
    process.exit(1)
  }
}

// Verify a key extracted from a stego image
async function verify(imageFile, publicKeyFile) {
  try {
    console.log(`🔍 Extracting key from ${imageFile}...`)
    const image = await Jimp.read(imageFile)
    const extracted = extractMessageFromImage(image)

    console.log("📜 Extracted JSON:", extracted)

    const keyData = JSON.parse(extracted)
    const privateKey = await importPrivateKey(keyData.pem)

    console.log("🔑 Verifying key pair...")
    const valid = await verifyKeyPair(privateKey, publicKeyFile)

    if (valid) {
      console.log("✅ Key pair verified successfully!")
      process.exit(0)
    } else {
      console.error("❌ Key pair verification failed!")
      process.exit(1)
    }
  } catch (error) {
    console.error("Error processing image:", error)
    process.exit(1)
  }
}

// Command-line interface
const [ , , mode, ...args] = process.argv
if (mode === "verify") {
  if (args.length < 2) {
    console.error("Usage: verify <stegoImage.png> <publicKeyFile>")
    process.exit(1)
  }
  const [imageFile, publicKeyFile] = args
  verify(imageFile, publicKeyFile)
} else {
  console.error("Usage: stego_verify.js verify <stegoImage.png> <publicKeyFile>")
  process.exit(1)
}
