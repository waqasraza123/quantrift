export const pricingCatalog = {
  checkoutEnabled: false,
  plans: [
    { key: "free", name: "Free", amount: 0, currency: "usd", interval: "month", credits: 0, members: 1, description: "Build your daily research routine." },
    { key: "pro", name: "Pro", amount: 2900, currency: "usd", interval: "month", credits: 100, members: 1, description: "Bring AI agents into your setup review." },
    { key: "team", name: "Team", amount: 7900, currency: "usd", interval: "month", credits: 500, members: 5, description: "Research together in a shared workspace." },
  ].map((plan) => ({ ...plan, features: ["Charts and market context", "Watchlists and market scanner", "Setup evidence and confidence", "Journal and saved research"] })),
};
