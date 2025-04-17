import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
    const token = req.query.token || req.headers['authorization']?.split(' ')[1];
  
    if (!token) {
      return res.status(403).json({ message: 'Token is missing' });
    }
  
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
  
      console.log('Decoded Token:', decoded);
      req.user = { id: decoded.userId };
      next();
    });
  };
  