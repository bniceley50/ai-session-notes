export type Session = {
  id: string;
  patientName: string;
  date: string;
  summary: string;
  transcript: string;
  note: string;
};

export const sessions: Session[] = [
  {
    id: "sess-001",
    patientName: "Maya Chen",
    date: "2026-01-28",
    summary: "Follow-up for migraine management and sleep disruption.",
    transcript:
      "Clinician: Good morning, Maya. How have the migraines been since we last met?\n\nPatient: They are less frequent, but when they do happen they still knock me out for a day.\n\nClinician: Any triggers you've noticed?\n\nPatient: Sleep, mostly. If I don't get enough rest, I wake up with one.\n\nClinician: Let's revisit the sleep routine and consider a preventive option.",
    note:
      "Subjective: Migraines are less frequent but still severe when they occur. Sleep disruption remains the primary trigger.\n\nAssessment: Migraine without aura, partially controlled.\n\nPlan: Reinforce sleep hygiene routine, continue current abortive therapy, discuss preventive options if frequency increases. Follow up in 6 weeks.",
  },
  {
    id: "sess-002",
    patientName: "Andre Rivera",
    date: "2026-01-29",
    summary: "Initial visit for knee pain after increased running volume.",
    transcript:
      "Clinician: Tell me about the knee pain you're feeling.\n\nPatient: It's right below the kneecap, especially when I go downstairs.\n\nClinician: Any swelling or instability?\n\nPatient: No swelling, just soreness after runs.\n\nClinician: We'll check strength and adjust your training plan.",
    note:
      "Subjective: Anterior knee pain after ramping up running mileage. No swelling or instability reported.\n\nAssessment: Suspect patellofemoral pain syndrome.\n\nPlan: Reduce running volume for 2 weeks, start quad/hip strengthening, and begin a gradual return to activity. Consider imaging if symptoms persist.",
  },
];

export function getSessionById(id: string): Session | undefined {
  return sessions.find((session) => session.id === id);
}
