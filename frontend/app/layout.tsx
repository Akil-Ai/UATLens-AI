import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "UATlens AI — AI-Powered UAT Test Case Generator",
  description:
    "AI drafts, the system validates, the human approves. Generate comprehensive User Acceptance Test cases from requirements documents with full traceability and quality validation.",
  keywords: [
    "UAT",
    "test case generator",
    "AI testing",
    "acceptance testing",
    "requirements analysis",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

# Commit ref: 85
