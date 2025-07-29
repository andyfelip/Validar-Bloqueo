import dotenv from 'dotenv';
dotenv.config();
import express, { json } from 'express';
const app = express();

app.use(json());

// Middleware de autenticación Basic Auth
app.use((req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Autenticación requerida');
  }

  const base64Credentials = auth.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [user, pass] = credentials.split(':');

  if (user === process.env.AUTH_USER && pass === process.env.AUTH_PASS) {
    return next();
  } else {
    return res.status(403).send('Credenciales incorrectas');
  }
});

// Endpoint para validar si una fecha cae en un bloqueo quincenal
app.post('/validar-dia', async (req, res) => {
  const { fecha } = req.body;

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Formato de fecha inválido (use YYYY-MM-DD)' });
  }

  try {
    const fechaEvaluada = new Date(fecha + "T12:00:00"); // hora neutra
    const year = fechaEvaluada.getFullYear();
    const month = fechaEvaluada.getMonth();

    // Función para obtener el martes 6AM después de un lunes
    const obtenerMartesSiguiente = (baseDate) => {
      const day = baseDate.getUTCDay();
      const diasHastaLunes = (8 - day) % 7;
      const lunes = new Date(baseDate);
      lunes.setUTCDate(lunes.getUTCDate() + diasHastaLunes);
      return new Date(Date.UTC(lunes.getUTCFullYear(), lunes.getUTCMonth(), lunes.getUTCDate() + 1, 6, 0, 0));
    };

    // --- BLOQUEO QUINCENA 1 (13-16) ---
    const dia13 = new Date(Date.UTC(year, month, 13, 18, 0, 0)); // 13 a las 6:00 PM
    let finBloqueo1 = new Date(Date.UTC(year, month, 17, 6, 0, 0)); // 17 a las 6:00 AM
    const diaSemana13 = dia13.getUTCDay();
    if ([4, 5, 6, 0].includes(diaSemana13)) {
      finBloqueo1 = obtenerMartesSiguiente(dia13);
    }

    if (fechaEvaluada >= dia13 && fechaEvaluada < finBloqueo1) {
      return res.status(423).json({
        esNoHabil: true,
        codigo: "BLQ-Q1",
        motivo: "Bloqueo quincenal del 13",
        rangoBloqueo: {
          inicio: dia13.toISOString(),
          fin: finBloqueo1.toISOString()
        }
      });
    }

    // --- BLOQUEO QUINCENA 2 (29-31) ---
    const dia29 = new Date(Date.UTC(year, month, 29, 18, 0, 0)); // 29 a las 6:00 PM
    let finBloqueo2;

    const diaSemana28 = new Date(Date.UTC(year, month, 28)).getUTCDay();
    const diaSemana29 = dia29.getUTCDay();
    const diaSemana30 = new Date(Date.UTC(year, month, 30)).getUTCDay();

    if ([4, 5].includes(diaSemana28) || [4, 5].includes(diaSemana29) || [4, 5].includes(diaSemana30)) {
      finBloqueo2 = obtenerMartesSiguiente(dia29);
    } else {
      finBloqueo2 = new Date(Date.UTC(year, month + 1, 1, 6, 0, 0)); // día 1 del siguiente mes a las 6:00 AM
    }

    if (fechaEvaluada >= dia29 && fechaEvaluada < finBloqueo2) {
      return res.status(423).json({
        esNoHabil: true,
        codigo: "BLQ-Q2",
        motivo: "Bloqueo quincenal del 29",
        rangoBloqueo: {
          inicio: dia29.toISOString(),
          fin: finBloqueo2.toISOString()
        }
      });
    }

    // --- FECHA HÁBIL ---
    return res.status(200).json({
      esNoHabil: false,
      codigo: "OK-00",
      motivo: 'Día hábil'
    });

  } catch (error) {
    console.error('Error al validar:', error.message);
    return res.status(500).json({ error: 'Error al procesar fecha' });
  }
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
