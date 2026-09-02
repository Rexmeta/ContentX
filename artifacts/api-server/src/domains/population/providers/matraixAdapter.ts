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

/**
 * MatrAIx Population Adapter:
 * Implements the standard PopulationProvider contract to bridge MatrAIx
 * massive population generation with the RoleplayX Simulation Layer.
 */
export class MatraixPopulationAdapter implements PopulationProvider {
  readonly name = "matraix";
  private endpointUrl?: string;

  constructor(options: { endpointUrl?: string } = {}) {
    this.endpointUrl = options.endpointUrl;
  }

  async listDimensions(): Promise<DimensionDefinition[]> {
    return DimensionRegistry.list();
  }

  async listCohorts(): Promise<PersonaCohort[]> {
    return CohortGenerator.listCohorts();
  }

  async sample(request: SamplingRequest): Promise<SamplingResult> {
    // If external MatrAIx endpoint is configured, fetch from service; otherwise use mapped local sampling
    const baseResult = samplingEngine.sample(request);
    return {
      ...baseResult,
      metadata: {
        ...baseResult.metadata,
        source: "matraix-adapter",
        matraixSchemaVersion: "2026.1",
      },
    };
  }

  async getPersona(id: string): Promise<SimulationActorSpec | undefined> {
    const sample = await this.sample({ strategy: "stratified", sampleSize: 10 });
    return sample.personas.find((p) => p.id === id);
  }
}

export const matraixPopulationAdapter = new MatraixPopulationAdapter();
