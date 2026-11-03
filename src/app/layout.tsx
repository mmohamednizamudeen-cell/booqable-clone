import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rental platform",
  description: "Inventory, bookings and online rentals for rental businesses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
