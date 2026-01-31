export interface Lawyer {
  id: number;
  name: string;
  category: "Family Law" | "Civil Law";
  experience: number;
  casesHandled: number;
  successRate: number;
  rating: number;
  fee: number;
  bio?: string;
  threadId?: string;
}

export const mockLawyers: Lawyer[] = [
  {
    id: 1,
    name: "Adv. Fatima Ali",
    category: "Civil Law",
    experience: 6,
    casesHandled: 120,
    successRate: 92,
    rating: 4.8,
    fee: 50000,
    bio:
      "Specializes in civil litigation and property disputes with a focus on clear client communication and case strategy.",
    threadId: "t-3",
  },
  {
    id: 2,
    name: "Adv. Ayesha Khan",
    category: "Family Law",
    experience: 5,
    casesHandled: 85,
    successRate: 88,
    rating: 4.7,
    fee: 40000,
    bio:
      "Family law practitioner experienced in custody, maintenance, and domestic dispute resolution.",
    threadId: "t-1",
  },
];
