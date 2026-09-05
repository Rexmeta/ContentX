import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contentRouter from "./content";
import scenariosRouter from "./scenarios";
import projectionsRouter from "./projections";
import charactersRouter from "./characters";
import populationsRouter from "./populations";
import agentsRouter from "./agents";
import simulationsRouter from "./simulations";
import workflowsRouter from "./workflows";
import jsonFormatsRouter from "./jsonFormats";
import simulationSpecsRouter from "./simulationSpecs";
import benchmarksRouter from "./benchmarks";
import simulationPopulationsRouter from "./simulationPopulations";
import experimentsRouter from "./experiments";
import agentGatewayRouter from "./agentGateway";
import continuousEvaluationRouter from "./continuousEvaluation";
import saasRouter from "./saas";
import commercialValidationRouter from "./commercialValidation";
import productionEvidenceRouter from "./productionEvidenceRoutes";
import customerValidationRouter from "./customerValidationRoutes";
import assessmentsRouter from "./assessments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contentRouter);
router.use(scenariosRouter);
router.use(projectionsRouter);
router.use(charactersRouter);
router.use(populationsRouter);
router.use(agentsRouter);
router.use(simulationsRouter);
router.use(workflowsRouter);
router.use(jsonFormatsRouter);
router.use(simulationSpecsRouter);
router.use(benchmarksRouter);
router.use(simulationPopulationsRouter);
router.use(experimentsRouter);
router.use(agentGatewayRouter);
router.use(continuousEvaluationRouter);
router.use(saasRouter);
router.use(commercialValidationRouter);
router.use(productionEvidenceRouter);
router.use(customerValidationRouter);
router.use(assessmentsRouter);

export default router;


