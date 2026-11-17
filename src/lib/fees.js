// Auction fee estimates. Tables carried over from the original RADAR calculator
// (Copart secured payment, live bid). They are estimates: the auction invoice is final.

const COPART_SALVAGE = [
  [49.99, 25], [99.99, 45], [199.99, 80], [299.99, 130], [349.99, 137.5], [399.99, 145],
  [449.99, 175], [499.99, 185], [549.99, 205], [599.99, 210], [699.99, 240], [799.99, 270],
  [899.99, 295], [999.99, 320], [1199.99, 375], [1299.99, 395], [1399.99, 410], [1499.99, 430],
  [1599.99, 445], [1699.99, 465], [1799.99, 485], [1999.99, 510], [2399.99, 535], [2499.99, 570],
  [2999.99, 610], [3499.99, 655], [3999.99, 705], [4499.99, 725], [4999.99, 750], [5499.99, 775],
  [5999.99, 800], [6499.99, 825], [6999.99, 845], [7499.99, 880], [7999.99, 900], [8499.99, 925],
  [8999.99, 945], [9999.99, 945], [14999.99, 1000],
];
const COPART_CLEAN = [
  [49.99, 25], [99.99, 45], [199.99, 80], [299.99, 120], [399.99, 120],
  [499.99, 160], [599.99, 185], [699.99, 210], [799.99, 230],
  [899.99, 250], [999.99, 275], [1199.99, 325], [1299.99, 350], [1399.99, 365], [1499.99, 380],
  [1599.99, 390], [1699.99, 410], [1799.99, 420], [1999.99, 440], [2399.99, 470], [2499.99, 480],
  [2999.99, 500], [3499.99, 600], [3999.99, 675], [4499.99, 710], [5999.99, 750],
  [7499.99, 800], [7999.99, 815], [9999.99, 840], [14999.99, 850],
];
const IAA = [
  [49.99, 25], [99.99, 45], [199.99, 80], [299.99, 130], [349.99, 137.5], [399.99, 145],
  [449.99, 175], [499.99, 185], [549.99, 205], [599.99, 210], [699.99, 240], [799.99, 270],
  [899.99, 295], [999.99, 320], [1199.99, 375], [1299.99, 395], [1399.99, 410], [1499.99, 430],
  [1599.99, 445], [1699.99, 465], [1799.99, 485], [1999.99, 510], [2399.99, 535], [2499.99, 570],
  [2999.99, 610], [3499.99, 655], [3999.99, 705], [4499.99, 725], [4999.99, 750], [5499.99, 775],
  [5999.99, 800], [6499.99, 825], [6999.99, 845], [7499.99, 880], [7999.99, 900], [8499.99, 925],
  [9999.99, 945], [14999.99, 1000],
];
const VIRTUAL_SALVAGE_IAA = [
  [99.99, 0], [499.99, 50], [999.99, 65], [1499.99, 85], [1999.99, 95],
  [3999.99, 110], [5999.99, 125], [7999.99, 145], [Infinity, 160],
];
const VIRTUAL_CLEAN = [
  [99.99, 0], [499.99, 49], [999.99, 59], [1499.99, 79], [1999.99, 89],
  [3999.99, 99], [5999.99, 109], [7999.99, 139], [Infinity, 149],
];

export const BROKER_FEE = 350; // RADAR CO flat fee per Copart/IAA vehicle
export const DEPOSIT_RATE = 0.5; // 50% of the maximum offer, applied to final payment
export const ENV_FEE = 15;
export const TITLE_MAIL_FEE = 15;

function lookup(table, b) {
  for (const [max, fee] of table) if (b <= max) return fee;
  return null;
}

export function buyerFee(offer, auction = "copart", title = "salvage") {
  const b = Number(offer) || 0;
  if (b <= 0) return 0;
  if (auction === "iaa") return lookup(IAA, b) ?? Math.round(b * 0.075);
  if (title === "clean") return lookup(COPART_CLEAN, b) ?? Math.round(b * 0.0725);
  return lookup(COPART_SALVAGE, b) ?? Math.round(b * 0.075);
}

export function virtualFee(offer, auction = "copart", title = "salvage") {
  const b = Number(offer) || 0;
  if (b <= 0) return 0;
  const t = auction === "copart" && title === "clean" ? VIRTUAL_CLEAN : VIRTUAL_SALVAGE_IAA;
  return lookup(t, b) ?? 0;
}

export function gateFee(auction = "copart", title = "salvage") {
  if (auction === "iaa") return 95;
  return title === "clean" ? 79 : 95;
}

export function estimate({ offer, auction = "copart", title = "salvage", transport = 0 }) {
  const b = Math.max(0, Number(offer) || 0);
  const buyer = buyerFee(b, auction, title);
  const virt = virtualFee(b, auction, title);
  const fixed = b > 0 ? gateFee(auction, title) + ENV_FEE + TITLE_MAIL_FEE : 0;
  const auctionFees = buyer + virt + fixed;
  const service = b > 0 ? BROKER_FEE : 0;
  const ship = Math.max(0, Number(transport) || 0);
  return {
    offer: b,
    buyer,
    virtual: virt,
    fixed,
    auctionFees,
    service,
    transport: ship,
    total: b + auctionFees + service + ship,
    deposit: Math.round(b * DEPOSIT_RATE * 100) / 100,
  };
}
