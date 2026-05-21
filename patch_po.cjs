const fs = require('fs');

function patchFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf8');
    let originalLength = content.length;
    for (const r of replacements) {
        content = content.replace(r.search, r.replace);
    }
    if (content.length !== originalLength) {
        fs.writeFileSync(path, content, 'utf8');
        console.log(`Patched ${path} successfully!`);
    } else {
        console.log(`Failed to patch ${path}: No changes made.`);
    }
}

patchFile('src/pages/dashboard/seller/SellerPreOrders.tsx', [
    {
        search: "  const [configForm, setConfigForm] = useState({",
        replace: "  const [isNewProduct, setIsNewProduct] = useState(false);\n  const [productForm, setProductForm] = useState({ name: '', price: '' });\n  const [configForm, setConfigForm] = useState({"
    },
    {
        search: "  const openConfigForm = (product: any) => {",
        replace: "  const openNewPoForm = () => {\n    setIsNewProduct(true);\n    setProductForm({ name: '', price: '' });\n    setConfigForm({ pickup_type: 'next_day', custom_days: 1, order_cutoff_time: '10:00', po_stock: 20, min_order: 1, max_order: 20, pickup_notes: 'Ambil di loket penjual, jam 07.00–11.00 WITA', open_days: [1,2,3,4,5] });\n    setSelectedProduct({ name: 'Produk Baru', id: 'new' });\n    setShowConfigForm(true);\n  };\n\n  const openConfigForm = (product: any) => {\n    setIsNewProduct(false);"
    },
    {
        search: "  const saveConfig = async () => {\n    if (!selectedProduct || !user) return;\n    try {\n      const payload = {\n        product_id: selectedProduct.id,",
        replace: "  const saveConfig = async () => {\n    if (!selectedProduct || !user) return;\n    try {\n      let productId = selectedProduct.id;\n      if (isNewProduct) {\n        if (!productForm.name || !productForm.price) throw new Error('Nama produk dan harga wajib diisi');\n        const { data: newProd, error: pErr } = await supabase.from('products').insert({\n          name: productForm.name,\n          price: Number(productForm.price),\n          seller_id: user.id,\n          is_active: true,\n          stock: 0,\n        }).select().single();\n        if (pErr) throw pErr;\n        productId = newProd.id;\n      }\n      const payload = {\n        product_id: productId,"
    },
    {
        search: "        <div className=\"space-y-4\">\n          <p className=\"text-sm text-zinc-500 dark:text-zinc-400\">Pilih produk dan atur mekanisme Pre-Order-nya. Hanya produk aktif yang bisa dikonfigurasi.</p>",
        replace: "        <div className=\"space-y-4\">\n          <div className=\"flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4\">\n            <p className=\"text-sm text-zinc-500 dark:text-zinc-400\">Pilih produk dan atur mekanisme Pre-Order-nya, atau buat PO baru langsung.</p>\n            <button onClick={openNewPoForm} className=\"btn-clay-primary bg-amber-500 hover:bg-amber-600 px-4 py-2 text-sm flex items-center gap-2\">\n              <Plus className=\"w-4 h-4\" /> Buat PO Baru\n            </button>\n          </div>"
    },
    {
        search: "                    <h2 className=\"text-xl font-black text-zinc-900 dark:text-white\">Setup Pre-Order</h2>\n                    <p className=\"text-sm text-zinc-500 font-medium\">{selectedProduct.name}</p>\n                  </div>",
        replace: "                    <h2 className=\"text-xl font-black text-zinc-900 dark:text-white\">Setup Pre-Order</h2>\n                    <p className=\"text-sm text-zinc-500 font-medium\">{selectedProduct.name}</p>\n                  </div>"
    },
    {
        search: "              <div className=\"p-6 space-y-5\">\n                <div className=\"flex items-center justify-between\">",
        replace: "              <div className=\"p-6 space-y-5\">\n                <div className=\"flex items-center justify-between\">"
    }
]);

// Wait, I need to inject the product form inputs inside the modal if isNewProduct is true.
let content = fs.readFileSync('src/pages/dashboard/seller/SellerPreOrders.tsx', 'utf8');
content = content.replace(
  "                    <h2 className=\"text-xl font-black text-zinc-900 dark:text-white\">Setup Pre-Order</h2>\n                    <p className=\"text-sm text-zinc-500 font-medium\">{selectedProduct.name}</p>\n                  </div>",
  "                    <h2 className=\"text-xl font-black text-zinc-900 dark:text-white\">Setup Pre-Order</h2>\n                    <p className=\"text-sm text-zinc-500 font-medium\">{selectedProduct.name}</p>\n                  </div>"
);

content = content.replace(
  "                <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">",
  "                {isNewProduct && (\n                  <div className=\"space-y-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl mb-4\">\n                    <h3 className=\"text-xs font-bold text-zinc-900 dark:text-white uppercase\">Informasi Produk</h3>\n                    <div>\n                      <label className=\"block text-[10px] font-bold text-zinc-500 uppercase mb-1\">Nama Produk PO</label>\n                      <input type=\"text\" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className=\"input-clay\" placeholder=\"Contoh: Roti Tawar Spesial\" />\n                    </div>\n                    <div>\n                      <label className=\"block text-[10px] font-bold text-zinc-500 uppercase mb-1\">Harga Produk</label>\n                      <input type=\"number\" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className=\"input-clay\" placeholder=\"Contoh: 15000\" />\n                    </div>\n                  </div>\n                )}\n                <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">"
);

fs.writeFileSync('src/pages/dashboard/seller/SellerPreOrders.tsx', content, 'utf8');
console.log('Second pass patching done');
