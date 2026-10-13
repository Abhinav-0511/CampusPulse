import { useState } from 'react';
import { Input, Select } from './ui';

/** Departments offered in the sign-up dropdown. Edit this list to match your college. */
export const DEPARTMENTS = [
  'Computer Science and Engineering',
  'Information Technology',
  'Artificial Intelligence and Data Science',
  'Artificial Intelligence and Machine Learning',
  'Computer Science and Business Systems',
  'Cyber Security',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biomedical Engineering',
];

const OTHER = '__other__';

/** Dropdown of departments, with "Other" revealing a text box (for other colleges' departments). */
export function DepartmentSelect({ value, onChange, required, placeholder = 'Select department', className }: { value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; className?: string }) {
  const listed = DEPARTMENTS.includes(value);
  const [other, setOther] = useState(!!value && !listed);
  return (
    <div className={`grid gap-2 ${className ?? ''}`}>
      <Select
        value={other ? OTHER : value}
        required={required}
        onChange={e => {
          if (e.target.value === OTHER) {
            setOther(true);
            onChange('');
          } else {
            setOther(false);
            onChange(e.target.value);
          }
        }}
        aria-label="Department"
      >
        <option value="">{placeholder}</option>
        {DEPARTMENTS.map(d => (
          <option key={d}>{d}</option>
        ))}
        <option value={OTHER}>Other (type it)</option>
      </Select>
      {other && <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Type your department" required={required} autoFocus aria-label="Department name" />}
    </div>
  );
}
