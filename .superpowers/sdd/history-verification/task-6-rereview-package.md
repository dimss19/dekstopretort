3c9bb1a fix: optional groups prop di ProcessDetailView agar tsc hijau
diff --git a/resources/js/Components/History/ProcessDetailView.tsx b/resources/js/Components/History/ProcessDetailView.tsx
index df667a8..6d839d5 100644
--- a/resources/js/Components/History/ProcessDetailView.tsx
+++ b/resources/js/Components/History/ProcessDetailView.tsx
@@ -21,20 +21,21 @@ export interface ProcessBatchItem {
         model_type?: string;
         machine?: {
             machine_name?: string;
         };
     };
 }
 
 interface Props {
     batch: ProcessBatchItem;
     onBack: () => void;
+    groups?: { id: number; name: string; color: string }[]; // ponytail: diterima & diabaikan dulu, dipakai penuh Task 7
 }
 
 export default function ProcessDetailView({ batch, onBack }: Props) {
     const [tablePage, setTablePage] = useState<number>(1);
     const [pageSize, setPageSize] = useState<number>(50);
     const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
 
     useEffect(() => {
         const closeMenu = () => setShowDownloadMenu(false);
         window.addEventListener('click', closeMenu);
