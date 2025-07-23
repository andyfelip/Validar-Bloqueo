import dotenv from 'dotenv'; 
dotenv.config()
import express, { json } from 'express';
const app = express();

// Middleware para parsear JSON
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
    const fechaConsulta = new Date(fecha + "T00:00:00");

    // Función para obtener número de semana del año
    const obtenerNumeroSemana = (date) => {
      const f = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = f.getUTCDay() || 7;
      f.setUTCDate(f.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(f.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil((((f - yearStart) / 86400000) + 1) / 7);
      return weekNum;
    };

    // Función para encontrar el miércoles de la semana de una fecha
    const getMiercolesInicio = (fechaBase) => {
      const miercoles = new Date(fechaBase);
      miercoles.setDate(miercoles.getDate() - miercoles.getDay() + 3); // miércoles
      miercoles.setHours(18, 0, 0, 0); // 6:00 PM
      return miercoles;
    };

    const semana = obtenerNumeroSemana(fechaConsulta);
    const esSemanaDeBloqueo = semana % 2 === 1;

    if (esSemanaDeBloqueo) {
      const inicioBloqueo = getMiercolesInicio(fechaConsulta);
      const finBloqueo = new Date(inicioBloqueo);
      finBloqueo.setDate(finBloqueo.getDate() + 7); // siguiente miércoles
      finBloqueo.setHours(6, 0, 0, 0); // 6:00 AM

      // Evaluamos si la fecha cae dentro del rango
      const fechaEvaluada = new Date(fecha + "T12:00:00"); // hora neutra

      if (fechaEvaluada >= inicioBloqueo && fechaEvaluada < finBloqueo) {
        return res.status(423).json({
          esNoHabil: true,
          codigo: "BLQ-Q",
          motivo: "Bloqueo quincenal activo (miércoles 6PM hasta siguiente miércoles 6AM)",
          rangoBloqueo: {
            inicio: inicioBloqueo.toISOString(),
            fin: finBloqueo.toISOString()
          }
        });
      }
    }

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
