"use client";

import { useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  MessageCircle,
  CheckCircle,
  Edit2,
  Trash2,
  GripVertical,
  Save
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { OnboardingStep, OnboardingStepType } from "@/lib/workspaces";

type Step = OnboardingStep;
type StepType = OnboardingStepType;

type StepIcon = ComponentType<{ className?: string }>;

type SortableStepCardProps = {
  step: Step;
  index: number;
  isEditing: boolean;
  editContent: string;
  editVariable: string;
  setEditContent: (value: string) => void;
  setEditVariable: (value: string) => void;
  startEdit: (step: Step) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  deleteStep: (id: string) => void;
  getStepIcon: (type: StepType) => StepIcon;
  getStepColor: (type: StepType) => string;
  getStepLabel: (type: StepType) => string;
};

// Sortable Step Card Component
function SortableStepCard({
  step,
  index,
  isEditing,
  editContent,
  editVariable,
  setEditContent,
  setEditVariable,
  startEdit,
  saveEdit,
  cancelEdit,
  deleteStep,
  getStepIcon,
  getStepColor,
  getStepLabel
}: SortableStepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = getStepIcon(step.type);
  const color = getStepColor(step.type);

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`p-4 border-2 transition-all ${
          color === "blue" ? "border-blue-200 bg-blue-50/30" :
          color === "green" ? "border-green-200 bg-green-50/30" :
          "border-purple-200 bg-purple-50/30"
        }`}
      >
        {isEditing ? (
          // Edit mode
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-neutral-700 mb-1 block">
                Contenido
              </label>
              <Input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Escribe el contenido..."
                className="h-9"
              />
            </div>
            {step.type === "question" && (
              <div>
                <label className="text-xs font-medium text-neutral-700 mb-1 block">
                  Variable (ej: name, email)
                </label>
                <Input
                  value={editVariable}
                  onChange={(e) => setEditVariable(e.target.value)}
                  placeholder="name"
                  className="h-9"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={saveEdit}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Guardar
              </Button>
              <Button
                onClick={cancelEdit}
                size="sm"
                className="bg-white hover:bg-neutral-50 text-neutral-700 border"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          // Display mode
          <div>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  {...attributes}
                  {...listeners}
                  aria-label="Reordenar paso"
                  className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-neutral-200/50 rounded"
                >
                  <GripVertical className="h-4 w-4 text-neutral-400" />
                </button>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  color === "blue" ? "bg-blue-600" :
                  color === "green" ? "bg-green-600" :
                  "bg-purple-600"
                }`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className={`text-xs font-semibold ${
                    color === "blue" ? "text-blue-700" :
                    color === "green" ? "text-green-700" :
                    "text-purple-700"
                  }`}>
                    {getStepLabel(step.type)}
                  </div>
                  {step.variable && (
                    <div className="text-xs text-neutral-500">
                      → guarda en {"{" + step.variable + "}"}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs font-medium text-neutral-400">
                #{index + 1}
              </span>
            </div>

            <p className="text-sm text-neutral-900 mb-3 font-medium ml-6">
              {step.content}
            </p>

            <div className="flex items-center gap-1 ml-6">
              <Button
                onClick={() => startEdit(step)}
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Editar
              </Button>
              <Button
                onClick={() => deleteStep(step.id)}
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

const TEMPLATE_STEPS: Step[] = [
  {
    id: "1",
    type: "question",
    content: "¿Cómo te llamas?",
    variable: "name"
  },
  {
    id: "2",
    type: "message",
    content: "¡Hola {name}! Bienvenido a nuestro programa."
  },
  {
    id: "3",
    type: "end",
    content: "Onboarding completado"
  }
];

export function OnboardingClient({
  workspaceSlug,
  initialSteps,
}: {
  workspaceSlug: string;
  initialSteps: Step[];
}) {
  const [steps, setSteps] = useState<Step[]>(
    initialSteps.length ? initialSteps : TEMPLATE_STEPS
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editVariable, setEditVariable] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const addStep = (type: StepType) => {
    const placeholders = {
      question: "Nueva pregunta",
      message: "Nuevo mensaje",
      end: "Fin del flujo"
    };

    const newStep: Step = {
      id: Date.now().toString(),
      type,
      content: placeholders[type],
      variable: type === "question" ? "variable" : undefined
    };

    setSteps([...steps, newStep]);
  };

  const deleteStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const startEdit = (step: Step) => {
    setEditingId(step.id);
    setEditContent(step.content);
    setEditVariable(step.variable || "");
  };

  const saveEdit = () => {
    if (!editingId) return;
    setSteps(steps.map(s =>
      s.id === editingId
        ? { ...s, content: editContent, variable: editVariable || undefined }
        : s
    ));
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
    setEditVariable("");
  };

  const saveFlow = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/onboarding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "No se pudo guardar el flujo");
        return;
      }
      toast.success("Flujo guardado correctamente");
    } catch {
      toast.error("Error de conexión al guardar el flujo");
    } finally {
      setIsSaving(false);
    }
  };

  const getStepIcon = (type: StepType) => {
    switch (type) {
      case "question": return MessageSquare;
      case "message": return MessageCircle;
      case "end": return CheckCircle;
    }
  };

  const getStepColor = (type: StepType) => {
    switch (type) {
      case "question": return "blue";
      case "message": return "green";
      case "end": return "purple";
    }
  };

  const getStepLabel = (type: StepType) => {
    switch (type) {
      case "question": return "PREGUNTA";
      case "message": return "MENSAJE";
      case "end": return "FIN";
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Flujo de Onboarding</h1>
          <p className="text-neutral-600 mt-1">
            Diseñá la conversación inicial con tus usuarios. El flujo guardado corre en la Vista Previa del Chat.
          </p>
        </div>
        <Button
          onClick={saveFlow}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      {/* Main Content: 2 columns */}
      <div className="flex-1 grid grid-cols-2 gap-6">
        {/* Left: Editor */}
        <div className="space-y-4 overflow-y-auto pr-2">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Pasos del flujo</h3>

            {/* Steps List with Drag & Drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={steps.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <SortableStepCard
                      key={step.id}
                      step={step}
                      index={index}
                      isEditing={editingId === step.id}
                      editContent={editContent}
                      editVariable={editVariable}
                      setEditContent={setEditContent}
                      setEditVariable={setEditVariable}
                      startEdit={startEdit}
                      saveEdit={saveEdit}
                      cancelEdit={cancelEdit}
                      deleteStep={deleteStep}
                      getStepIcon={getStepIcon}
                      getStepColor={getStepColor}
                      getStepLabel={getStepLabel}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add Step Buttons */}
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-neutral-600 mb-2">Agregar paso:</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => addStep("question")}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white h-9"
                >
                  <MessageSquare className="h-3 w-3 mr-1.5" />
                  Pregunta
                </Button>
                <Button
                  onClick={() => addStep("message")}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white h-9"
                >
                  <MessageCircle className="h-3 w-3 mr-1.5" />
                  Mensaje
                </Button>
                <Button
                  onClick={() => addStep("end")}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white h-9"
                >
                  <CheckCircle className="h-3 w-3 mr-1.5" />
                  Fin
                </Button>
              </div>
            </div>
          </Card>

          {/* Info Card */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-blue-900 mb-1">¿Cómo funciona?</p>
                <ul className="text-blue-800 space-y-1 text-xs">
                  <li>• <strong>Pregunta:</strong> El bot hace una pregunta y guarda la respuesta</li>
                  <li>• <strong>Mensaje:</strong> El bot envía un mensaje (puede usar variables)</li>
                  <li>• <strong>Fin:</strong> Termina el onboarding</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Preview */}
        <div>
          <Card className="p-6 h-full">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Vista Previa</h3>

            <div className="bg-neutral-50 rounded-lg p-4 h-[calc(100%-2rem)] overflow-y-auto">
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className="text-xs font-medium text-neutral-400 mt-1">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      {step.type === "question" ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">B</span>
                            </div>
                            <div className="bg-white rounded-2xl px-4 py-2 shadow-sm border max-w-[80%]">
                              <p className="text-sm text-neutral-900">{step.content}</p>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <div className="bg-blue-600 rounded-2xl px-4 py-2 shadow-sm max-w-[80%]">
                              <p className="text-sm text-white">[Respuesta del usuario]</p>
                            </div>
                          </div>
                        </div>
                      ) : step.type === "message" ? (
                        <div className="flex gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">B</span>
                          </div>
                          <div className="bg-white rounded-2xl px-4 py-2 shadow-sm border max-w-[80%]">
                            <p className="text-sm text-neutral-900">{step.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-3">
                          <div className="bg-purple-100 rounded-full px-4 py-1.5 border border-purple-300">
                            <p className="text-xs font-semibold text-purple-700">
                              ✓ {step.content}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
