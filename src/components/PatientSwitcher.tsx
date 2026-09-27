import { patients } from "@/data/patients"

type PatientSwitcherProps = {
  value: string
  onChange: (patientId: string) => void
}

export function PatientSwitcher({ value, onChange }: PatientSwitcherProps) {
  return (
    <select
      id="patient-switcher"
      className="patient-select"
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
  )
}
