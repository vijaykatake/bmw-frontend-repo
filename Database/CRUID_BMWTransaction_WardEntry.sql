USE [BioMedicalWaste];
GO

-- Drop procedure if it already exists for clean re-creation
DROP PROCEDURE IF EXISTS [BMWTransaction].[CRUID_BMWTransaction_WardEntry];
GO

CREATE PROCEDURE [BMWTransaction].[CRUID_BMWTransaction_WardEntry] (  
    @BMWWardEntryId bigint = Null,  
    @BMWWardId tinyint = Null,  
    @BMWCategoryId tinyint = Null,  
    @BMWTypeID tinyint = Null,  
    @BMWUnitID tinyint = Null,  
    @BMWVolume decimal(10,2) = Null,  
    @BMWScanCode varchar(max) = Null,  
    @BMWDisposalTypeID tinyint = Null,  
    @BMWDisposalLocationID tinyint = Null,  
    @BMWTemporaryAreadID tinyint = Null,  
    @BMWStorageRoomID tinyint = Null,  
    @BMWStatusID tinyint = Null,  
    @BMWRemark varchar(2000) = Null,
	@BMWWardApprovalRemark varchar(2000) = Null,
	@BMWStorageAreaRemark varchar(2000) = Null,
	@BMWCollectionRemark varchar(2000) = Null,
	@BMWBaggingRemark varchar(2000) = Null,
	@BMWStorageRoomRemark varchar(2000) = Null,
	@BMWDispatchRemark varchar(2000) = Null,
    @BMWIsWardEntryDeleted bit = Null,  
    @BMWTransUserID tinyint = Null,  
    @BMWApprovedBy tinyint = Null,  
    @BMWApprovedDate datetime = Null,  
	@BMWStorageAreaShiftedBy tinyint = Null,  
    @BMWStorageAreaShiftedDate datetime = Null,
    @BMWTransValue tinyint = 0,
    @DBCommand varchar(max) = null
)
As
Begin -- Procedure Start
	BEGIN TRY -- Try Catch Block
		 if ((Select [BMWConfiguration].[MaintenanceStatus]() )= '1')  
         Begin 
             EXEC [BMWArchitecture].[ExecuteMessage] @CurrentIdentification = 'Maintenance', @TransMessageId = 5006, @ReplaceWord = ''; 
             RETURN; 
         End; -- Under Maintenance Code.

		 Declare @Already bit = 'false';
		 Declare @ReplaceDesc varchar(500);

		 -- 1. For Adding New Record.
		 IF(@BMWTransValue = 1) 	 
         Begin 
             Insert Into [BMWTransaction].[WardEntry] (
                 [WardId],[CategoryId],[TypeID],[UnitID],[Volume],[ScanCode],
                 [DisposalTypeID],[DisposalLocationID],[TemporaryAreadID],[StorageRoomID],
                 [StatusID],[Remark],[IsWardEntryDeleted],[AddedBy],[AddedDate],[ApprovedBy],[ApprovedDate]
             )  
             Select 
                 @BMWWardId, @BMWCategoryId, @BMWTypeID, @BMWUnitID, @BMWVolume, @BMWScanCode, 
                 @BMWDisposalTypeID, @BMWDisposalLocationID, @BMWTemporaryAreadID, @BMWStorageRoomID, 
                 @BMWStatusID, @BMWRemark, ISNULL(@BMWIsWardEntryDeleted, 0), @BMWTransUserID, GETDATE(), 
                 @BMWApprovedBy, @BMWApprovedDate; 

             -- Build descriptive string for outgoing message
             Select @ReplaceDesc = CONCAT(
                 ISNULL(w.WardName, 'Ward'), ' - ',
                 ISNULL(c.WasteCategoryName, 'Category'), ' - ',
                 ISNULL(t.WasteTypeName, 'Type'), ' - ',
                 CAST(ISNULL(@BMWVolume, 0) AS VARCHAR(20)), ' ',
                 ISNULL(u.Short, '')
             )
             From (SELECT @BMWWardId AS WardId, @BMWCategoryId AS CategoryId, @BMWTypeID AS TypeID, @BMWUnitID AS UnitID) x
             Left Join [BMWMaster].[Ward] w On w.WardId = x.WardId
             Left Join [BMWMaster].[WasteCategory] c On c.WasteCategoryId = x.CategoryId
             Left Join [BMWMaster].[WasteType] t On t.WasteTypeId = x.TypeID
             Left Join [BMWMaster].[Unit] u On u.UnitId = x.UnitID;

             Exec [BMWArchitecture].[ExecuteMessage] 'Add', '5067', @ReplaceDesc; 
             RETURN; 
         End

		 -- 2. For Updating Record.
		 IF(@BMWTransValue = 2) 	 
         Begin 
             Update [BMWTransaction].[WardEntry] 
             Set [WardId] = @BMWWardId,
                 [CategoryId] = @BMWCategoryId,
                 [TypeID] = @BMWTypeID,
                 [UnitID] = @BMWUnitID,
                 [Volume] = @BMWVolume,
                 [ScanCode] = @BMWScanCode,
                 [DisposalTypeID] = @BMWDisposalTypeID,
                 [DisposalLocationID] = @BMWDisposalLocationID,
                 [TemporaryAreadID] = @BMWTemporaryAreadID,
                 [StorageRoomID] = @BMWStorageRoomID,
                 [StatusID] = @BMWStatusID,
                 [Remark] = @BMWRemark,
                 [ApprovedBy] = @BMWApprovedBy,
                 [ApprovedDate] = @BMWApprovedDate,
                 [UpdatedBy] = @BMWTransUserID,
                 [UpdatedDate] = GETDATE() 
             Where [WardEntryId] = @BMWWardEntryId; 

             -- Build descriptive string for outgoing message
             Select @ReplaceDesc = CONCAT(
                 ISNULL(w.WardName, 'Ward'), ' - ',
                 ISNULL(c.WasteCategoryName, 'Category'), ' - ',
                 ISNULL(t.WasteTypeName, 'Type'), ' - ',
                 CAST(ISNULL(@BMWVolume, 0) AS VARCHAR(20)), ' ',
                 ISNULL(u.Short, '')
             )
             From (SELECT @BMWWardId AS WardId, @BMWCategoryId AS CategoryId, @BMWTypeID AS TypeID, @BMWUnitID AS UnitID) x
             Left Join [BMWMaster].[Ward] w On w.WardId = x.WardId
             Left Join [BMWMaster].[WasteCategory] c On c.WasteCategoryId = x.CategoryId
             Left Join [BMWMaster].[WasteType] t On t.WasteTypeId = x.TypeID
             Left Join [BMWMaster].[Unit] u On u.UnitId = x.UnitID;

             Exec [BMWArchitecture].[ExecuteMessage] 'Update', '5068', @ReplaceDesc; 
             RETURN; 
         End

		 -- 3. For Deleting Record.
		 IF(@BMWTransValue = 3) 	 
         Begin 
             -- Fetch details before performing soft-delete update
             Select @ReplaceDesc = CONCAT(
                 ISNULL(w.WardName, 'Ward'), ' - ',
                 ISNULL(c.WasteCategoryName, 'Category'), ' - ',
                 ISNULL(t.WasteTypeName, 'Type'), ' - ',
                 CAST(ISNULL(main.Volume, 0) AS VARCHAR(20)), ' ',
                 ISNULL(u.Short, '')
             )
             From [BMWTransaction].[WardEntry] main
             Left Join [BMWMaster].[Ward] w On w.WardId = main.WardId
             Left Join [BMWMaster].[WasteCategory] c On c.WasteCategoryId = main.CategoryId
             Left Join [BMWMaster].[WasteType] t On t.WasteTypeId = main.TypeID
             Left Join [BMWMaster].[Unit] u On u.UnitId = main.UnitID
             Where main.WardEntryId = @BMWWardEntryId;

             Update [BMWTransaction].[WardEntry] 
             Set [IsWardEntryDeleted] = 1,
                 [UpdatedBy] = @BMWTransUserID,
                 [UpdatedDate] = GETDATE() 
             Where [WardEntryId] = @BMWWardEntryId; 

             Exec [BMWArchitecture].[ExecuteMessage] 'Delete', '5069', @ReplaceDesc; 
             RETURN; 
         End

		 -- 4. For Selecting Single Record.
		 IF(@BMWTransValue = 4) 	 
         Begin 
             Select [WardEntryId],[WardId],[CategoryId],[TypeID],[UnitID],[Volume],[ScanCode],[DisposalTypeID],[DisposalLocationID],[TemporaryAreadID],[StorageRoomID],[StatusID],[Remark],[IsWardEntryDeleted],[AddB].[UserName] As [AUser],FORMAT([Main].[AddedDate],'dd-MMM-yy hh:mm tt') As [ADate],[ApprovedBy],[ApprovedDate],[UpdB].[UserName] As [UUser],FORMAT([Main].[UpdatedDate],'dd-MMM-yy hh:mm tt') As [UDate] 
             From [BMWTransaction].[WardEntry] [Main] 
             Left join [BMWApplication].[Users] [AddB] On [AddB].UserID = [Main].AddedBy 
             Left join [BMWApplication].[Users] [UpdB] On [UpdB].UserID = [Main].UpdatedBy 
             Where [Main].[WardEntryId] = @BMWWardEntryId And [Main].[IsWardEntryDeleted] = 'false' 
             Order By [Main].[AddedDate] desc; 
         End

		 -- 5. For Selecting Record List.
		 IF(@BMWTransValue = 5) 	 
         Begin 
             Select [WardEntryId],[WardId],[CategoryId],[TypeID],[UnitID],[Volume],[ScanCode],[DisposalTypeID],[DisposalLocationID],[TemporaryAreadID],[StorageRoomID],[StatusID],[Remark],[IsWardEntryDeleted],[AddB].[UserName] As [AUser],FORMAT([Main].[AddedDate],'dd-MMM-yy hh:mm tt') As [ADate],[ApprovedBy],[ApprovedDate],[UpdB].[UserName] As [UUser],FORMAT([Main].[UpdatedDate],'dd-MMM-yy hh:mm tt') As [UDate] 
             From [BMWTransaction].[WardEntry] [Main] 
             Left join [BMWApplication].[Users] [AddB] On [AddB].UserID = [Main].AddedBy 
             Left join [BMWApplication].[Users] [UpdB] On [UpdB].UserID = [Main].UpdatedBy 
             Where [Main].[IsWardEntryDeleted] = 'false' 
             Order By [Main].[AddedDate] desc; 
         End

		 -- 6. For Ward In-Charge Approval Action.
		 IF(@BMWTransValue = 6)
		 Begin
             -- Fetch details for confirmation message display
             Select @ReplaceDesc = CONCAT(
                 ISNULL(w.WardName, 'Ward'), ' - ',
                 ISNULL(c.WasteCategoryName, 'Category'), ' - ',
                 ISNULL(t.WasteTypeName, 'Type'), ' - ',
                 CAST(ISNULL(main.Volume, 0) AS VARCHAR(20)), ' ',
                 ISNULL(u.Short, '')
             )
             From [BMWTransaction].[WardEntry] main
             Left Join [BMWMaster].[Ward] w On w.WardId = main.WardId
             Left Join [BMWMaster].[WasteCategory] c On c.WasteCategoryId = main.CategoryId
             Left Join [BMWMaster].[WasteType] t On t.WasteTypeId = main.TypeID
             Left Join [BMWMaster].[Unit] u On u.UnitId = main.UnitID
             Where main.WardEntryId = @BMWWardEntryId;

		     Update [BMWTransaction].[WardEntry] 
		     Set [WardApprovalRemark] = @BMWWardApprovalRemark,
				 [StatusID] = 4,
				 [ApprovedBy] = @BMWTransUserID, 
		         [ApprovedDate] = GETDATE()
		     Where [WardEntryId] = @BMWWardEntryId; 

		     Exec [BMWArchitecture].[ExecuteMessage] 'Approval', '5070', @ReplaceDesc; 
		     RETURN; 
		 End

		 -- 7. Dropdown list for WardId
		 IF(@BMWTransValue = 7)
		 Begin
		     Select [WardId], [WardName] 
		     From [BMWMaster].[Ward] 
		     Where [IsWardActive] = 1 And [IsWardDeleted] = 0 
		     Order By [WardName]; 
		     RETURN; 
		 End

		 -- 8. Dropdown list for CategoryId (WasteCategory)
		 IF(@BMWTransValue = 8)
		 Begin
		     Select [WasteCategoryId], [WasteCategoryName], [WasteCategoryColorCode] 
		     From [BMWMaster].[WasteCategory] 
		     Order By [WasteCategoryId]; 
		     RETURN; 
		 End

		 -- 9. Dropdown list for TypeID (WasteType)
		 IF(@BMWTransValue = 9)
		 Begin
		     Select [WasteTypeId], [WasteCategoryId], [WasteTypeName] 
		     From [BMWMaster].[WasteType] 
		     Where [IsWasteTypeActive] = 1 
               And [IsWasteTypeDeleted] = 0 
               And ([WasteCategoryId] = @BMWCategoryId Or @BMWCategoryId Is Null)
		     Order By [WasteTypeName]; 
		     RETURN; 
		 End

		 -- 10. Dropdown list for UnitID
		 IF(@BMWTransValue = 10)
		 Begin
		     Select [UnitId], [Unit], [Short] 
		     From [BMWMaster].[Unit] 
		     Where [IsActive] = 1 
		     Order By [Unit]; 
		     RETURN; 
		 End
         -- 11. DataTable Result Set (Package, QR, Action, User) Used In Ward Entry And 
         IF(@BMWTransValue = 11)
         Begin
             Select 
                 CONCAT(
                     'Ward: ', ISNULL(w.WardName, 'N/A'),
                     ' $$ Category: ', ISNULL(c.WasteCategoryName, 'N/A'),
                     ' $$ Type: ', ISNULL(t.WasteTypeName, 'N/A'),
                     ' $$ Status: ', ISNULL(s.StatusCode, 'N/A'),
                     ' $$ Volume: ', CAST(ISNULL(Main.Volume, 0) AS VARCHAR(20)), ' ', ISNULL(u.Unit, ''),
					 ' $$ Remark: ', ISNULL(Main.Remark, ''),
                     CASE 
                         WHEN NULLIF(LTRIM(RTRIM(Main.WardApprovalRemark)), '') IS NOT NULL 
                         THEN CONCAT(' $$ Approval Remark: ', Main.WardApprovalRemark) 
                         ELSE '' 
                     END,
                     CASE 
                         WHEN NULLIF(LTRIM(RTRIM(Main.StorageAreaRemark)), '') IS NOT NULL 
                         THEN CONCAT(' $$ Storage Area Remark: ', Main.StorageAreaRemark) 
                         ELSE '' 
                     END,
                     CASE 
                         WHEN NULLIF(LTRIM(RTRIM(Main.CollectionRemark)), '') IS NOT NULL 
                         THEN CONCAT(' $$ Collection Remark: ', Main.CollectionRemark) 
                         ELSE '' 
                     END,
                     CASE 
                         WHEN NULLIF(LTRIM(RTRIM(Main.BaggingRemark)), '') IS NOT NULL 
                         THEN CONCAT(' $$ Baggage Remark: ', Main.BaggingRemark) 
                         ELSE '' 
                     END,
                     CASE 
                         WHEN NULLIF(LTRIM(RTRIM(Main.StorageRoomRemark)), '') IS NOT NULL 
                         THEN CONCAT(' $$ Storage Room Remark: ', Main.StorageRoomRemark) 
                         ELSE '' 
                     END,
                     CASE 
                         WHEN NULLIF(LTRIM(RTRIM(Main.DispatchRemark)), '') IS NOT NULL 
                         THEN CONCAT(' $$ Dispatch Remark: ', Main.DispatchRemark) 
                         ELSE '' 
                     END
                 ) As [Waste],
                 CONCAT(
                     ISNULL(Main.ScanCode, ''),
                     ' $$ Status: ',
                     ISNULL(s.StatusCode, ''),
					 ' $$ Info: ',
                     ISNULL(s.StatusDescription, '')
                 ) As [QR],
                 Main.WardEntryId As [Action],
                 CONCAT(
                     'Added By: ', ISNULL(AddB.UserName, 'N/A'),
                     ' $$ Added Date: ', ISNULL(FORMAT(Main.AddedDate, 'dd-MMM-yy hh:mm tt'), ''),
                     CASE 
                         WHEN Main.UpdatedBy IS NOT NULL AND Main.UpdatedDate IS NOT NULL 
                         THEN CONCAT(' $$ Updated By: ', UpdB.UserName, ' $$ Updated Date: ', FORMAT(Main.UpdatedDate, 'dd-MMM-yy hh:mm tt'))
                         ELSE ''
                     END,
                     CASE 
                         WHEN Main.ApprovedBy IS NOT NULL AND Main.ApprovedDate IS NOT NULL 
                         THEN CONCAT(' $$ Waste Package Approved By: ', ApprB.UserName, ' $$ Waste Package Approval Date: ', FORMAT(Main.ApprovedDate, 'dd-MMM-yy hh:mm tt'))
                         ELSE ''
                     END,
                     CASE 
                         WHEN Main.StorageAreaShiftedBy IS NOT NULL AND Main.StorageAreaShiftedDate IS NOT NULL 
                         THEN CONCAT(' $$ Storage Area Shifted By: ', SAShiftB.UserName, ' $$ Storage Area Shifted Date: ', FORMAT(Main.StorageAreaShiftedDate, 'dd-MMM-yy hh:mm tt'))
                         ELSE ''
                     END,
                     CASE 
                         WHEN Main.CollectedAndVarifiedBy IS NOT NULL AND Main.CollectedAndVarifiedDate IS NOT NULL 
                         THEN CONCAT(' $$ BMW Collected By: ', ColB.UserName, ' $$ BMW Collection Date: ', FORMAT(Main.CollectedAndVarifiedDate, 'dd-MMM-yy hh:mm tt'))
                         ELSE ''
                     END,
                     CASE 
                         WHEN Main.BaggedBy IS NOT NULL AND Main.BaggedDate IS NOT NULL 
                         THEN CONCAT(' $$ BMW Bagged By: ', BagB.UserName, ' $$ BMW Bagged Date: ', FORMAT(Main.BaggedDate, 'dd-MMM-yy hh:mm tt'))
                         ELSE ''
                     END,
                     CASE 
                         WHEN Main.StorageRoomShiftedBy IS NOT NULL AND Main.StorageRoomShiftedDate IS NOT NULL 
                         THEN CONCAT(' $$ Storage Room Shifted By: ', SRShiftB.UserName, ' $$ Storage Room Shifted Date: ', FORMAT(Main.StorageRoomShiftedDate, 'dd-MMM-yy hh:mm tt'))
                         ELSE ''
                     END,
                     CASE 
                         WHEN Main.DispatchedBy IS NOT NULL AND Main.DispatchedDate IS NOT NULL 
                         THEN CONCAT(' $$ Dispatched By: ', DispB.UserName, ' $$ Dispatch Date: ', FORMAT(Main.DispatchedDate, 'dd-MMM-yy hh:mm tt'))
                         ELSE ''
                     END
                 ) As [User]
             From [BMWTransaction].[WardEntry] [Main]
             Left Join [BMWMaster].[Ward] w On w.WardId = Main.WardId
             Left Join [BMWMaster].[WasteCategory] c On c.WasteCategoryId = Main.CategoryId
             Left Join [BMWMaster].[WasteType] t On t.WasteTypeId = Main.TypeID
             Left Join [BMWMaster].[Unit] u On u.UnitId = Main.UnitID
             Left Join [BMWMaster].[Status] s On s.StatusID = Main.StatusID
             Left Join [BMWApplication].[Users] [AddB] On [AddB].UserID = [Main].AddedBy
             Left Join [BMWApplication].[Users] [UpdB] On [UpdB].UserID = [Main].UpdatedBy
             Left Join [BMWApplication].[Users] [ApprB] On [ApprB].UserID = [Main].ApprovedBy
             Left Join [BMWApplication].[Users] [SAShiftB] On [SAShiftB].UserID = [Main].StorageAreaShiftedBy
             Left Join [BMWApplication].[Users] [ColB] On [ColB].UserID = [Main].CollectedAndVarifiedBy
             Left Join [BMWApplication].[Users] [BagB] On [BagB].UserID = [Main].BaggedBy
             Left Join [BMWApplication].[Users] [SRShiftB] On [SRShiftB].UserID = [Main].StorageRoomShiftedBy
             Left Join [BMWApplication].[Users] [DispB] On [DispB].UserID = [Main].DispatchedBy
             Where [Main].[IsWardEntryDeleted] = 'false' 
               And (@BMWWardEntryId IS NULL AND [Main].StatusID = @BMWStatusID OR [Main].WardEntryId = @BMWWardEntryId)
             Order By [Main].[AddedDate] desc;
             RETURN;
         End
		 -- 12. List Of Storage Area For Temporary Area Shifting Action.
		 IF(@BMWTransValue = 12)
		 Begin
			SELECT 0 AS [StorageAreaId], 'Select Storage Area ... ' AS [StorageAreaName], '' AS [StorageAreaDescription] UNION SELECT [StorageAreaId], [StorageAreaName], [StorageAreaDescription] FROM [BioMedicalWaste].[BMWMaster].[StorageArea] Where [IsStorageAreaActive] = 'true' And [IsStorageAreaDeleted] = 'false' Order By [StorageAreaId];
		 End
		 -- 13. For Temporary Area Shifting Action.
		 IF(@BMWTransValue = 13)
		 Begin
             -- Fetch details for confirmation message display
             Select @ReplaceDesc = CONCAT(
                 ISNULL(w.WardName, 'Ward'), ' - ',
                 ISNULL(c.WasteCategoryName, 'Category'), ' - ',
                 ISNULL(t.WasteTypeName, 'Type'), ' - ',
                 CAST(ISNULL(main.Volume, 0) AS VARCHAR(20)), ' ',
                 ISNULL(u.Short, '')
             )
             From [BMWTransaction].[WardEntry] main
             Left Join [BMWMaster].[Ward] w On w.WardId = main.WardId
             Left Join [BMWMaster].[WasteCategory] c On c.WasteCategoryId = main.CategoryId
             Left Join [BMWMaster].[WasteType] t On t.WasteTypeId = main.TypeID
             Left Join [BMWMaster].[Unit] u On u.UnitId = main.UnitID
             Where main.WardEntryId = @BMWWardEntryId;

		     Update [BMWTransaction].[WardEntry] 
		     Set [StorageAreaRemark] = @BMWStorageAreaRemark,
				 [TemporaryAreadID] = @BMWTemporaryAreadID ,
				 [StatusID] = 5,
				 [StorageAreaShiftedBy] = @BMWTransUserID, 
		         [StorageAreaShiftedDate] = GETDATE()
		     Where [WardEntryId] = @BMWWardEntryId; 

		     Exec [BMWArchitecture].[ExecuteMessage] 'Approval', '5071', @ReplaceDesc; 
		     RETURN; 
		 End
	END TRY -- Try Catch Block End
	BEGIN CATCH  -- Begin Catch Block Start
		Insert InTo [BMWLog].[SQLLog] ([DML], [ERROR_SEVERITY], [ERROR_STATE], [ERROR_PROCEDURE], [ERROR_LINE], [ERROR_MESSAGE])  
		Select @DBCommand As [DML], ERROR_SEVERITY() As [ERROR_SEVERITY], ERROR_STATE() As [ERROR_STATE], ERROR_PROCEDURE() As [ERROR_PROCEDURE], ERROR_LINE() As [ERROR_LINE], ERROR_MESSAGE() As [ERROR_MESSAGE];
        
		Select 206 As [ResultID], ERROR_SEVERITY() As ErrorSeverity, ERROR_STATE() As ErrorState, ERROR_PROCEDURE() As ErrorProcedure, ERROR_LINE() As ErrorLine, ERROR_MESSAGE() As [TransMessage];   
	END CATCH; -- Begin Catch Block End
End -- Procedure End
GO