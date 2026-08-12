import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contentRouter from "./content";
import scenariosRouter from "./scenarios";
import projectionsRouter from "./projections";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contentRouter);
router.use(scenariosRouter);
router.use(projectionsRouter);

export default router;
