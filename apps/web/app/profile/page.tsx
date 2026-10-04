"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { AppShell, PageLoading } from "@/components/app-shell";
import { Button, FormMessage, SelectField, TextField } from "@/components/ui";
import { ApiError, api, type ProfileData } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

type Values = {
  preferredName: string;
  location: string;
  nationality: string;
  phone: string;
  education: string;
  occupation: string;
  maritalStatus: ProfileData["maritalStatus"];
  practice: string;
  quranStudy: string;
  religiousNotes: string;
  siblings: string;
  parents: string;
  familyNotes: string;
};

const toValues = (p: ProfileData): Values => ({
  preferredName: p.preferredName ?? "",
  location: p.location ?? "",
  nationality: p.nationality ?? "",
  phone: p.phone ?? "",
  education: p.education ?? "",
  occupation: p.occupation ?? "",
  maritalStatus: p.maritalStatus,
  practice: p.religiousInfo.practice ?? "",
  quranStudy: p.religiousInfo.quranStudy ?? "",
  religiousNotes: p.religiousInfo.notes ?? "",
  siblings: p.familyInfo.siblings?.toString() ?? "",
  parents: p.familyInfo.parents ?? "",
  familyNotes: p.familyInfo.notes ?? "",
});

const areaClass =
  "mt-1.5 block w-full rounded-md border border-border bg-white px-3.5 py-2.5 text-base text-nile focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise";

export default function ProfilePage() {
  const { data, error } = useLoad<ProfileData>("/profile");
  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<Values>();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data) reset(toValues(data));
  }, [data, reset]);

  async function onSubmit(v: Values) {
    setSaved(false);
    setSaveError(null);
    const siblings = v.siblings.trim() === "" ? undefined : Number(v.siblings);
    try {
      const updated = await api<ProfileData>("/profile", {
        method: "PATCH",
        body: {
          preferredName: v.preferredName,
          location: v.location,
          nationality: v.nationality,
          phone: v.phone,
          education: v.education,
          occupation: v.occupation,
          maritalStatus: v.maritalStatus,
          religiousInfo: { practice: v.practice, quranStudy: v.quranStudy, notes: v.religiousNotes },
          familyInfo: { ...(siblings !== undefined && Number.isInteger(siblings) ? { siblings } : {}), parents: v.parents, notes: v.familyNotes },
        },
      });
      reset(toValues(updated));
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  if (!data) return <AppShell width="max-w-3xl"><PageLoading error={error?.message} /></AppShell>;

  return (
    <AppShell width="max-w-3xl">
      <h1 className="text-3xl font-semibold text-nile">Your profile</h1>
      <p className="editorial mt-3 text-lg text-nile/90">
        Add details gradually. Nothing here is visible to anyone else, and only what a stage needs is ever shared with a match.
      </p>

      <section aria-label="Details fixed at registration" className="mt-8 rounded-lg border border-border bg-white p-6">
        <h2 className="font-semibold text-nile">Fixed at registration</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-text-muted">Full name</dt><dd className="font-semibold text-nile">{data.fullName}</dd></div>
          <div><dt className="text-text-muted">Gender</dt><dd className="font-semibold text-nile">{data.gender === "MALE" ? "Male" : "Female"}</dd></div>
          <div><dt className="text-text-muted">Date of birth</dt><dd className="font-semibold text-nile">{new Date(data.dateOfBirth).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-text-muted">To correct any of these, please contact support.</p>
      </section>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-8">
        <section className="space-y-5 rounded-lg border border-border bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-nile">About you</h2>
          <TextField label="Preferred name" autoComplete="nickname" {...register("preferredName")} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Where you live" autoComplete="address-level2" {...register("location")} />
            <TextField label="Nationality" {...register("nationality")} />
          </div>
          <TextField label="Phone" type="tel" autoComplete="tel" hint="Used only to reach you. Never shared with a match." {...register("phone")} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Education" {...register("education")} />
            <TextField label="Occupation" {...register("occupation")} />
          </div>
          <SelectField label="Marital status" {...register("maritalStatus")}>
            <option value="NEVER_MARRIED">Never married</option>
            <option value="DIVORCED">Divorced</option>
            <option value="WIDOWED">Widowed</option>
          </SelectField>
        </section>

        <section className="space-y-5 rounded-lg border border-border bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-nile">Faith</h2>
          <TextField label="Religious practice" hint="In your own words." {...register("practice")} />
          <TextField label="Qur'an and Islamic study" {...register("quranStudy")} />
          <div>
            <label htmlFor="religiousNotes" className="block text-sm font-semibold text-nile">Anything else</label>
            <textarea id="religiousNotes" rows={3} className={areaClass} {...register("religiousNotes")} />
          </div>
        </section>

        <section className="space-y-5 rounded-lg border border-border bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-nile">Family</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Number of siblings" type="number" min={0} max={30} inputMode="numeric" {...register("siblings")} />
            <TextField label="Parents" hint="For example: both living, or one living." {...register("parents")} />
          </div>
          <div>
            <label htmlFor="familyNotes" className="block text-sm font-semibold text-nile">Anything else</label>
            <textarea id="familyNotes" rows={3} className={areaClass} {...register("familyNotes")} />
          </div>
        </section>

        {saveError && <FormMessage tone="error">{saveError}</FormMessage>}
        {saved && !isDirty && <FormMessage tone="success">Saved.</FormMessage>}
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </AppShell>
  );
}
