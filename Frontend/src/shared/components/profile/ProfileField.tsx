interface ProfileFieldProps {
  label: string;
  value: string;
}

export default function ProfileField({ label, value }: ProfileFieldProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
        {value}
      </div>
    </div>
  );
}
