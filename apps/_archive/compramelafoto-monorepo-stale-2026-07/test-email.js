import "dotenv/config";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  await resend.emails.send({
    from: "ComprameLaFoto <info@compramelafoto.com>",
    to: ["compramelafoto@gmail.com"],
    subject: "✅ Email OK desde ComprameLaFoto",
    html: "<p>Si leés esto, Resend ya está funcionando perfecto.</p>",
  });

  console.log("Email enviado OK");
}

testEmail();
