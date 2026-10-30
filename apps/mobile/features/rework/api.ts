import type { ReworkEntry, ReworkReason } from "@rps/shared";
import { http } from "../../lib/api-client";

export const reworkApi = {
  flagRework: async (
    unitCode: string,
    reasons: ReworkReason[],
    note: string | undefined,
    photoUris: string[],
  ): Promise<ReworkEntry> => {
    const formData = new FormData();
    for (const r of reasons) {
      formData.append("reasons", r);
    }
    if (note && note.trim().length > 0) {
      formData.append("note", note.trim());
    }
    photoUris.forEach((uri, i) => {
      formData.append("photos", {
        uri,
        name: `photo-${i}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob);
    });

    const res = await http.post(`/worker/units/${unitCode}/rework`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.data ?? res.data;
  },

  listMyRework: async (): Promise<ReworkEntry[]> => {
    const res = await http.get("/worker/rework");
    return res.data?.data ?? res.data ?? [];
  },
};
