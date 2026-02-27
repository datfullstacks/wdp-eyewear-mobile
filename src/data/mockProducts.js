// src/data/mockProducts.js

export const MOCK_PRODUCTS = [
  {
    id: "lens_01",
    type: "LENS",
    name: "Tròng kính trong suốt",
    brand: "Essilor",
    price: 1162000,
    originalPrice: 1550000,
    discountPct: 25,
    status: "Có sẵn",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80",
    color: [],

    ratingAvg: 4.7,
    ratingCount: 124,
    soldCount: 124,

    stockStatus: "IN_STOCK",
    stockLabel: "Còn hàng",
    shipping: { etaLabel: "Giao nhanh 1–3 ngày" },

    orderTypes: ["READY", "CUSTOM"],
    defaultOrderType: "READY",

    lensRxFields: ["CYL", "AXIS"],

    specs: [
      { label: "Chất liệu", value: "Kính" },
      { label: "Hình dáng", value: "Tròn (Round)" },
      { label: "Độ rộng", value: "140mm" },
      { label: "Chiều dài càng", value: "145mm" },
      { label: "Trọng lượng", value: "10g" },
    ],

    sections: {
      description:
        "Tròng kính trong suốt, dễ phối gọng. Phù hợp sử dụng hằng ngày.",
      sizeGuide:
        "Chọn theo thông số gọng. Nếu chưa rõ, chọn “Làm theo đơn” để được tư vấn.",
    },

    qaCount: 0,
    relatedIds: ["frame_01", "frame_02", "frame_03"],
  },

  {
    id: "frame_01",
    type: "FRAME",
    name: "Kính mắt gọng tròn Aviator Titanium siêu nhẹ",
    brand: "Ray-Ban",
    price: 1290000,
    originalPrice: 1509000,
    discountPct: 10,
    status: "Có sẵn",
    image:
      "https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=1200&q=60",
    color: ["Black", "Navy", "Beige"],

    ratingAvg: 4.7,
    ratingCount: 124,
    soldCount: 124,

    stockStatus: "IN_STOCK",
    stockLabel: "Còn hàng",
    shipping: { etaLabel: "Giao nhanh 1–3 ngày" },

    orderTypes: ["READY", "PREORDER", "CUSTOM"],
    defaultOrderType: "READY",

    colors: [
      { id: "black", name: "Đen", hex: "#111111" },
      { id: "navy", name: "Xanh", hex: "#374151" },
      { id: "beige", name: "Be", hex: "#D6C9B4" },
      { id: "gold", name: "Vàng", hex: "#C9A227" },
    ],
    sizes: ["S", "M", "L"],
    qtyLimits: { min: 1, max: 10 },
    model3D: { enabled: true },

    specs: [
      { label: "Chất liệu", value: "Titanium siêu nhẹ" },
      { label: "Hình dáng", value: "Tròn (Round)" },
      { label: "Độ rộng", value: "140mm" },
      { label: "Chiều dài càng", value: "145mm" },
      { label: "Trọng lượng", value: "15g" },
    ],

    sections: {
      description:
        "Gọng titanium nhẹ, bền, phù hợp đeo lâu. Thiết kế aviator tròn thời trang.",
      sizeGuide:
        "Chọn size theo độ rộng mặt: S < 135mm, M 135–145mm, L > 145mm.",
    },

    qaCount: 0,
    relatedIds: ["lens_01", "frame_02", "frame_03"],
  },

  {
    id: "frame_02",
    type: "FRAME",
    name: "Kính mắt vuông nhựa",
    brand: "Warby Parker",
    price: 890000,
    discountPct: 0,
    status: "Đặt trước",
    image:
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&q=80",
    color: ["Black", "Silver"],

    ratingAvg: 4.6,
    ratingCount: 52,
    soldCount: 80,

    stockStatus: "PREORDER",
    stockLabel: "Đặt trước",
    shipping: { etaLabel: "Dự kiến 5–7 ngày" },

    orderTypes: ["PREORDER", "CUSTOM"],
    defaultOrderType: "PREORDER",

    colors: [
      { id: "black", name: "Đen", hex: "#111111" },
      { id: "silver", name: "Bạc", hex: "#9CA3AF" },
    ],
    sizes: ["M", "L"],
    qtyLimits: { min: 1, max: 5 },
    model3D: { enabled: false },

    specs: [
      { label: "Chất liệu", value: "Nhựa acetate" },
      { label: "Hình dáng", value: "Vuông" },
      { label: "Độ rộng", value: "142mm" },
      { label: "Chiều dài càng", value: "145mm" },
      { label: "Trọng lượng", value: "18g" },
    ],
    sections: {
      description: "Gọng nhựa bền, dễ phối đồ, phù hợp nhiều khuôn mặt.",
      sizeGuide: "Nếu mặt nhỏ chọn M, mặt vừa/lớn chọn L.",
    },

    qaCount: 2,
    relatedIds: ["frame_01"],
  },

  {
    id: "frame_03",
    type: "FRAME",
    name: "Kính mắt Clubmaster",
    brand: "Oakley",
    price: 1190000,
    status: "Có sẵn",
    image:
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&q=80",
    color: ["Black", "Gold"],

    ratingAvg: 4.8,
    ratingCount: 88,
    soldCount: 140,

    stockStatus: "IN_STOCK",
    stockLabel: "Còn hàng",
    shipping: { etaLabel: "Giao nhanh 1–3 ngày" },

    orderTypes: ["READY", "CUSTOM"],
    defaultOrderType: "READY",

    colors: [
      { id: "black", name: "Đen", hex: "#111111" },
      { id: "gold", name: "Vàng", hex: "#C9A227" },
    ],
    sizes: ["S", "M"],
    qtyLimits: { min: 1, max: 10 },
    model3D: { enabled: true },

    specs: [
      { label: "Chất liệu", value: "Kim loại + nhựa" },
      { label: "Hình dáng", value: "Clubmaster" },
      { label: "Độ rộng", value: "138mm" },
      { label: "Chiều dài càng", value: "145mm" },
      { label: "Trọng lượng", value: "16g" },
    ],
    sections: {
      description: "Thiết kế cổ điển, hợp đi làm/đi chơi.",
      sizeGuide: "Mặt nhỏ chọn S, mặt vừa chọn M.",
    },

    qaCount: 0,
    relatedIds: ["frame_01"],
  },
];

export const getRelatedProducts = (products, relatedIds = []) => {
  const map = new Map(products.map((p) => [p.id, p]));
  return relatedIds.map((id) => map.get(id)).filter(Boolean);
};
