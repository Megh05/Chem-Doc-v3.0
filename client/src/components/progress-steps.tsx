interface ProgressStepsProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export default function ProgressSteps({ currentStep, onStepClick }: ProgressStepsProps) {
  const steps = [
    { id: 1, title: "Upload Documents", subtitle: "Supplier CoA/TDS/MDMS" },
    { id: 2, title: "Select Template", subtitle: "Company format" },
    { id: 3, title: "AI Processing", subtitle: "OCR & Data Extraction" },
    { id: 4, title: "Review & Download", subtitle: "Final document" },
  ];

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <button
            onClick={() => onStepClick(step.id)}
            className="flex items-center focus:outline-none"
            data-testid={`step-${step.id}`}
          >
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-colors ${
                step.id <= currentStep
                  ? "bg-primary-500 text-white"
                  : "bg-gray-300 text-gray-600"
              }`}
            >
              {step.id}
            </div>
            <div className="ml-3 text-left">
              <p
                className={`text-sm font-medium ${
                  step.id <= currentStep ? "text-primary-500" : "text-gray-600"
                }`}
              >
                {step.title}
              </p>
              <p className="text-xs text-gray-500">{step.subtitle}</p>
            </div>
          </button>
          
          {index < steps.length - 1 && (
            <div className="flex-1 mx-4">
              <div
                className={`h-1 rounded transition-colors ${
                  step.id < currentStep ? "bg-primary-500" : "bg-gray-300"
                }`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
