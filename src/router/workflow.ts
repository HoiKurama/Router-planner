import { WORKFLOWS } from '../data/policy'
import type { TaskRequirements, WorkflowPlan, WorkflowProfile } from '../domain/types'

const stableCompare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

/**
 * The smallest working environment that provides every required tool, plus suggested steps.
 * This is advice for the user: the app does not check which tools a model offers in its app.
 */
export function makeWorkflow(requirements: TaskRequirements, workflows: readonly WorkflowProfile[] = WORKFLOWS): WorkflowPlan | null {
  const profile = [...workflows]
    .filter((workflow) => requirements.requiredTools.every((tool) => workflow.tools.includes(tool)))
    .sort((a, b) => a.tools.length - b.tools.length || stableCompare(a.id, b.id))[0]
  if (!profile) return null
  const steps: string[] = []
  if (requirements.requiredTools.includes('fileRead')) steps.push('Dateikontext bereitstellen und lesen')
  if (requirements.requiredTools.includes('webSearch')) steps.push('Aktuelle Quellen recherchieren')
  if (requirements.capabilityNeeds.some((need) => need.id === 'planning')) steps.push('Arbeitsschritte planen')
  steps.push(requirements.category === 'coding' ? 'Lösung implementieren' : requirements.category === 'writing' ? 'Text bearbeiten'
    : requirements.category === 'learning' ? 'Erklärung erarbeiten' : requirements.category === 'dataAnalysis' ? 'Daten auswerten'
      : requirements.category === 'planning' ? 'Plan ausarbeiten' : 'Aufgabe bearbeiten')
  steps.push(...requirements.validationSteps)
  return { profile, tools: requirements.requiredTools, steps }
}
