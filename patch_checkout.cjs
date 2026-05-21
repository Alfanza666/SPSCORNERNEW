const fs = require('fs');

let c = fs.readFileSync('src/pages/kiosk/Checkout.tsx', 'utf8');

c = c.replace(
  /if \(items\.length === 0 \|\| !buyerName\) \{\s*navigate\('\/kiosk'\);\s*return;\s*\}/,
  "if (!transactionId && (items.length === 0 || !buyerName)) {\n      navigate('/kiosk');\n      return;\n    }"
);

c = c.replace(
  /toast\.success\('Berhasil membayar dengan Points!'\);\s*clearCart\(\);\s*setReservations\(\[\]\);\s*navigate\('\/kiosk\/success', \{ state: \{ transactionId: transaction\.id \} \}\);/,
  "toast.success('Berhasil membayar dengan Points!');\n      setReservations([]);\n      navigate('/kiosk/success', { state: { transactionId: transaction.id } });"
);

c = c.replace(
  /toast\.success\('Pembayaran berhasil diverifikasi!'\);\s*clearCart\(\);\s*setReservations\(\[\]\);\s*sessionStorage\.removeItem\('buyerName'\);\s*navigate\('\/kiosk\/success', \{ state: \{ transactionId \} \}\);/,
  "toast.success('Pembayaran berhasil diverifikasi!');\n        setReservations([]);\n        navigate('/kiosk/success', { state: { transactionId } });"
);

c = c.replace(
  /onClick=\{\(\) => \{\s*clearCart\(\);\s*sessionStorage\.removeItem\('buyerName'\);\s*navigate\('\/kiosk\/success', \{ state: \{ transactionId \} \}\);\s*\}\}/,
  "onClick={() => {\n                  navigate('/kiosk/success', { state: { transactionId } });\n                }}"
);

fs.writeFileSync('src/pages/kiosk/Checkout.tsx', c);
console.log('Patched');
