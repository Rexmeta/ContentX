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

export default router;
