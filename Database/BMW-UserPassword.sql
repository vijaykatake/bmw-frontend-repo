USE [BioMedicalWaste];
GO

UPDATE [BMWApplication].[Users]
SET [UserPassword] = 'sha512$BMWSystem-1.0$9A6F03E426701484C4ADCD3BAEED79821897588BE91A39C5F662E77D43EE55FBB8EBF530D5329DB8702112CFEFDA4CD235B1D7E3D53D4A7C91EBDBB3F0E02560'
WHERE [LoginID] = 'Administrator';
GO

-- UserPassword stores a salted one-way verifier. It is intentionally not decryptable.
