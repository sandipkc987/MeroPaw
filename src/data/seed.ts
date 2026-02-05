import type { FeedItem } from "@src/types";

export const DOG_SRC = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=200&h=200&fit=crop";

export const seedData: FeedItem[] = [
  { id: "med1", type: "med", title: "Medication • Bravecto 250 mg", note: "Given with food. Next due Aug 20.", ts: Date.now() - 4 * 60 * 60 * 1000, image: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800" },
  { id: "vax1", type: "vet", title: "Vaccination • Rabies (1-yr)", note: "Lot #... Expires: 2026-05-21", ts: Date.now() - 28 * 60 * 60 * 1000, image: "https://images.unsplash.com/photo-1601758125946-6ec2c74b77e3?w=800" },
  { id: "ms1", type: "milestone", title: "Milestone • 100 Days Together", note: "🐾 Mastered \"stay.\"", ts: Date.now() - 120 * 24 * 60 * 60 * 1000, image: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=800" },
  { id: "mem1", type: "memory", title: "First Day Home", note: "First day together! So excited and a little nervous. Already exploring the new backyard.", ts: Date.now() - 6 * 60 * 60 * 1000, image: "https://images.unsplash.com/photo-1560807707-8cc77767d783?w=800" },
  { id: "exp1", type: "expense", title: "Dog Food - Premium Brand", note: "Bought 20lb bag of premium dog food", ts: Date.now() - 2 * 24 * 60 * 60 * 1000, receipt: { type: 'pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', name: 'dog_food_receipt.pdf' } },
  { id: "exp2", type: "expense", title: "Vet Visit - Checkup", note: "Annual checkup and vaccinations", ts: Date.now() - 5 * 24 * 60 * 60 * 1000, receipt: { type: 'image', url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=800', name: 'vet_receipt.jpg' } }
];

export const navItems = [
  { label: "Profile", screen: "Profile", menuIcon: "person-outline", color: "#8b5cf6" },
  { label: "Memories", screen: "Memories", menuIcon: "images-outline", color: "#6E8BFF" },
  { label: "Expenses", screen: "Expenses", menuIcon: "wallet-outline", color: "#FF8A5B" },
  { label: "Health", screen: "Health", menuIcon: "medical-outline", color: "#F25DA2" },
  { label: "Reminders", screen: "Reminders", menuIcon: "notifications-outline", color: "#8F6CF3" }
] as const;

export const sheetOptions = [
  { kind: "vet", title: "Vet Visit", emoji: "💉" },
  { kind: "med", title: "Medication", emoji: "💊" },
  { kind: "expense", title: "Expense", emoji: "💰" },
  { kind: "memory", title: "Memories", emoji: "📸" },
  { kind: "milestone", title: "Milestone", emoji: "🏆" }
] as const;
