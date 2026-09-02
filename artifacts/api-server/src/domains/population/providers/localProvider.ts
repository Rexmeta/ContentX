import type {
  PopulationProvider,
  DimensionDefinition,
  PersonaCohort,
  SamplingRequest,
  SamplingResult,
  SimulationActorSpec,
} from "@workspace/simulation-contract";
import { DimensionRegistry } from "../dimensionRegistry";
import { CohortGenerator } from "../cohortGenerator";
import { samplingEngine } from "../samplingEngine";

export class LocalPopulationProvider implements PopulationProvider {
  readonly name = "local";

  async listDimensions(): Promise<DimensionDefinition[]> {
    return DimensionRegistry.list();
  }

  async listCohorts(): Promise<PersonaCohort[]> {
    return CohortGenerator.listCohorts();
  }

  async sample(request: SamplingRequest): Promise<SamplingResult> {
    return samplingEngine.sample(request);
  }

  async getPersona(id: string): Promise<SimulationActorSpec | undefined> {
    const result = samplingEngine.sample({ strategy: "stratified", sampleSize: 20 });
    return result.personas.find((p) => p.id === id);
  }
}

export const localPopulationProvider = new LocalPopulationProvider();
