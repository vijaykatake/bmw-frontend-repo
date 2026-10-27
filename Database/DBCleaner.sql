USE [db_aceaf5_bmw]; -- Make sure you are in the correct database
GO

SET NOCOUNT ON;

DECLARE @SQL NVARCHAR(MAX);

BEGIN TRY
    PRINT '---------------------------------------------------';
    PRINT 'Starting Database Cleanup (Dropping all objects)...';
    PRINT '---------------------------------------------------';

    -- 1. Drop all Check Constraints
    SET @SQL = '';
    SELECT @SQL = ISNULL(@SQL + ' ', '') + 'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(name) + ';' 
    FROM sys.check_constraints;
    IF LEN(@SQL) > 0 
    BEGIN
        EXEC(@SQL);
        PRINT '-> All Check Constraints dropped.';
    END;

    -- 2. Drop all Foreign Key Constraints (Resolves dependency issues)
    SET @SQL = '';
    SELECT @SQL = ISNULL(@SQL + ' ', '') + 'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(name) + ';' 
    FROM sys.foreign_keys;
    IF LEN(@SQL) > 0 
    BEGIN
        EXEC(@SQL);
        PRINT '-> All Foreign Keys dropped.';
    END;

    -- 3. Drop all Stored Procedures
    SET @SQL = '';
    SELECT @SQL = ISNULL(@SQL + ' ', '') + 'DROP PROCEDURE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) + ';' 
    FROM sys.procedures;
    IF LEN(@SQL) > 0 
    BEGIN
        EXEC(@SQL);
        PRINT '-> All Stored Procedures dropped.';
    END;

    -- 4. Drop all Functions (Scalar, Inline, Table-valued)
    SET @SQL = '';
    SELECT @SQL = ISNULL(@SQL + ' ', '') + 'DROP FUNCTION ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) + ';' 
    FROM sys.objects 
    WHERE type IN ('FN', 'IF', 'TF', 'FS', 'FT');
    IF LEN(@SQL) > 0 
    BEGIN
        EXEC(@SQL);
        PRINT '-> All Functions dropped.';
    END;

    -- 5. Drop all Tables
    SET @SQL = '';
    SELECT @SQL = ISNULL(@SQL + ' ', '') + 'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) + ';' 
    FROM sys.tables;
    IF LEN(@SQL) > 0 
    BEGIN
        EXEC(@SQL);
        PRINT '-> All Tables dropped.';
    END;

    -- 6. Drop all Custom Schemas (leaving system schemas intact)
    SET @SQL = '';
    SELECT @SQL = ISNULL(@SQL + ' ', '') + 'DROP SCHEMA ' + QUOTENAME(name) + ';' 
    FROM sys.schemas 
    WHERE principal_id <> schema_id 
      AND name NOT IN ('dbo', 'guest', 'INFORMATION_SCHEMA', 'sys');
    IF LEN(@SQL) > 0 
    BEGIN
        EXEC(@SQL);
        PRINT '-> All Custom Schemas dropped.';
    END;

    PRINT '---------------------------------------------------';
    PRINT 'Database is now completely empty and clean!';
    PRINT '---------------------------------------------------';

END TRY
BEGIN CATCH
    PRINT '===================================================';
    PRINT 'ERROR ENCOUNTERED DURING CLEANUP:';
    PRINT 'Error Message : ' + ERROR_MESSAGE();
    PRINT 'Error Line    : ' + CAST(ERROR_LINE() AS VARCHAR(10));
    PRINT '===================================================';
    THROW;
END CATCH;