import { patients } from "@/data/patients"

type PatientSwitcherProps = {
  value: string
  onChange: (patientId: string) => void
}

export function PatientSwitcher({ value, onChange }: PatientSwitcherProps) {
  return (
    <label className="pointer-events-auto flex max-w-[min(100%,20rem)] flex-col gap-1">
      <span className="text-[11px] font-medium tracking-[0.16em] text-[#1c1f24]/55">PATIENT</span>
      <select
        id="patient-switcher"
        name="patient"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-[#1c1f24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="Choose patient"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {patients.map((patient) => (
          <option key={patient.id} value={patient.id}>
            {patient.label}
          </option>
        ))}
      </select>
    </label>
  )
}
