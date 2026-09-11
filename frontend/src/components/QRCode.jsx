import React, { useState } from "react";

/**
 * Renders a QR code for `value`. There's no bundler-free way to generate a
 * QR code purely offline in this project (no QR-encoding dependency is
 * installed), so this asks a public QR-image API to render the PNG at
 * request time — the same approach many lightweight prototypes use. If the
 * request fails (e.g. no internet on the viewing device), it falls back to
 * a plain text code so the credential ID is still visible and copyable.
 */
export default function QRCode({ value, size = 168 }) {
  const [failed, setFailed] = useState(false);
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(value)}`;

  if (failed) {
    return (
      <div className="pram-qr-fallback" style={{ width: size, height: size }}>
        <span>QR unavailable — share this link instead</span>
      </div>
    );
  }

  return (
    <img
      className="pram-qr-img"
      src={src}
      width={size}
      height={size}
      alt="Scan to verify this credential"
      onError={() => setFailed(true)}
    />
  );
}
