import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import Card from "../../../shared/components/dashboard/Card";
import { caseInfo, timeline } from "../data/casetrack.mock";

function Badge({ text, color }: { text: string; color?: string }) {
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-1 rounded-md ${
        color || "bg-gray-100 text-gray-600"
      }`}
    >
      {text}
    </span>
  );
}

export default function CaseTracking() {
  const navigate = useNavigate();

  const statusColors: Record<string, string> = {
    Completed: "border-green-500 text-green-700 bg-green-50",
    "In Progress": "border-blue-500 text-blue-700 bg-blue-50",
    Pending: "border-gray-400 text-gray-600 bg-gray-50",
  };

  return (
    <DashboardLayout
      brandTitle={
        <div
          className="flex items-start gap-3 cursor-pointer"
          onClick={() => navigate({ to: "/client-dashboard" })}
        >
          <ArrowLeft className="mt-1 h-5 w-5 text-white" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold">Case Tracking</span>
            <p className="text-sm text-green-100">Monitor your case progress</p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* --- Case Info --- */}
        <Card className="p-6 border border-green-100 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            {caseInfo.caseNumber}{" "}
            <Badge
              text={caseInfo.status}
              color="bg-purple-100 text-purple-700"
            />
          </h2>
          <p className="text-gray-700 mb-4">{caseInfo.title}</p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Category</p>
              <p className="font-medium">{caseInfo.category}</p>
            </div>
            <div>
              <p className="text-gray-500">Filed Date</p>
              <p className="font-medium">{caseInfo.filedDate}</p>
            </div>
            <div>
              <p className="text-gray-500">Client</p>
              <p className="font-medium">{caseInfo.client}</p>
            </div>
            <div>
              <p className="text-gray-500">Lawyer</p>
              <p className="font-medium">{caseInfo.lawyer}</p>
            </div>
          </div>
        </Card>

        {/* --- Case Timeline --- */}
        <Card className="p-6 border border-gray-100 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Case Timeline
          </h3>

          <div className="space-y-4">
            {timeline.map((step, i) => (
              <div
                key={i}
                className="relative flex items-start gap-4 border border-gray-200 rounded-lg p-4"
              >
                {/* Timeline Icon */}
                <div
                  className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${
                    step.status === "Completed"
                      ? "bg-green-100 text-green-700"
                      : step.status === "In Progress"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <step.icon className="h-4 w-4" />
                </div>

                {/* Timeline Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{step.title}</h4>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-md border ${statusColors[step.status]}`}
                    >
                      {step.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {step.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {step.date} - {step.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
