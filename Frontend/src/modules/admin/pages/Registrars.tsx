import { useNavigate } from "@tanstack/react-router";

const mockedRegistrars = [
  {
    id: "1",
    name: "Muhammad Asif",
    email: "asif.registrar@lawflow.pk",
    role: "Registrar",
    phone: "+92 300 1234567",
  },
  {
    id: "2",
    name: "Ayesha Khan",
    email: "ayesha.registrar@lawflow.pk",
    role: "Senior Registrar",
    phone: "+92 301 2223344",
  },
];

export default function Registrars() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Registrars</h1>
            <p className="text-sm text-gray-600">Manage registrar accounts</p>
          </div>

          <button
            onClick={() => navigate({ to: "/admin-registrars/create" })}
            className="rounded-xl bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23]"
          >
            + Create Registrar
          </button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 text-xs font-semibold text-gray-500 border-b border-gray-200">
            <div className="col-span-4">Name</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {mockedRegistrars.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-12 px-5 py-4 items-center border-b border-gray-100"
            >
              <div className="col-span-4">
                <div className="font-semibold text-gray-900">{r.name}</div>
                <div className="text-sm text-gray-500">{r.phone}</div>
              </div>

              <div className="col-span-4 text-sm text-gray-700">{r.email}</div>
              <div className="col-span-2 text-sm text-gray-700">{r.role}</div>

              <div className="col-span-2 text-right">
                <button
                  onClick={() =>
                    navigate({ to: `/admin-registrars/edit/${r.id}` })
                  }
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}

          {mockedRegistrars.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">No registrars found.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
