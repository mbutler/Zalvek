Here's a **short and clear README** in Markdown format that explains what each script does. This README will help document your steganography system for future reference.

---

### **🔑 Steganography Key Management**
This project provides a set of scripts for **embedding, extracting, and verifying cryptographic keys hidden inside PNG images** using **LSB (Least Significant Bit) steganography**.

#### **📜 Scripts Overview**
| Script         | Purpose |
|---------------|---------|
| `generator.js` | Generates a public/private RSA key pair, embeds the private key into a PNG image, and outputs an HTML page for key verification. |
| `embed.js`     | Embeds a **custom message** into a PNG image, fully compatible with `extract.js` and `generator.js`. |
| `extract.js`   | Extracts a **hidden message** from a PNG stego image and prints it to the console. |
| `verify.js`    | Extracts the **private key** from a PNG image and verifies it against a provided public key file. |

---

## **🛠 Usage Instructions**
### **1️⃣ Generate Keys & Embed into PNG**
```sh
bun generator.js input.png output.png output.html
```
- Generates an **RSA key pair**.
- **Embeds** the private key into `output.png`.
- Generates `output.html` for **browser-based verification**.

---

### **2️⃣ Embed a Custom Message into PNG**
```sh
bun embed.js input.png "Your hidden message" output.png
```
- Hides `"Your hidden message"` inside `output.png`.
- Works **with `extract.js`** to retrieve the message.

---

### **3️⃣ Extract a Hidden Message from PNG**
```sh
bun extract.js output.png
```
- Reads the **hidden message** from `output.png`.
- Outputs the message to the **console**.

---

### **4️⃣ Verify a Private Key from PNG**
```sh
bun verify.js output.png public_key.pem
```
- Extracts the **private key** from `output.png`.
- Compares it with `public_key.pem` to ensure **validity**.
- Outputs ✅ **"Key pair verified successfully!"** if valid.

---

## **🔍 Example Workflow**
```sh
bun generator.js input.png stego.png keys.html  # Step 1: Generate & Embed Keys
bun extract.js stego.png                        # Step 2: Extract the Hidden Key
bun verify.js stego.png public_key.pem          # Step 3: Verify the Key Pair
```

---

## **🚀 Compatibility**
- **`embed.js` & `extract.js`** follow the same **bit encoding** method as `generator.js` for full compatibility.
- **`verify.js`** properly decodes **PEM-encoded keys** for cryptographic validation.

---

## **📌 Notes**
- Ensure the input PNG has enough space to store the message.
- If verification fails, ensure the correct **public key** file is provided.

---

### **🎯 Final Thoughts**
This system allows **securely embedding cryptographic keys** inside images and verifying them via both **command-line** and **browser-based** methods. 🚀  

Let me know if you'd like any modifications! 🛠✨