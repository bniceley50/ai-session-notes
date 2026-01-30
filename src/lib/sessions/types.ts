export type DbSession = {
  id: string;
  org_id: string;
  label: string;
  status: string;
  created_by: string;
  created_at: string;
};

export type DbTranscript = {
  id: string;
  org_id: string;
  session_id: string;
  content: string;
  created_at: string;
};

export type DbNote = {
  id: string;
  org_id: string;
  session_id: string;
  note_type: string;
  content: string;
  created_at: string;
};

export type SessionWithDetails = DbSession & {
  transcript?: DbTranscript;
  note?: DbNote;
};
