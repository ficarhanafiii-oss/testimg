package com.webrunner.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    private PluginCall savedCall;

    // Dipanggil dari JS: FolderPicker.pickFolder()
    @PluginMethod
    public void pickFolder(PluginCall call) {
        savedCall = call;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "handleFolderResult");
    }

    @ActivityCallback
    private void handleFolderResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("User batal memilih folder");
            return;
        }

        Uri treeUri = result.getData().getData();
        // Persist permission supaya bisa dipakai lagi
        getActivity().getContentResolver().takePersistableUriPermission(
            treeUri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION
        );

        DocumentFile rootDir = DocumentFile.fromTreeUri(getContext(), treeUri);
        if (rootDir == null) { call.reject("Folder tidak valid"); return; }

        try {
            JSONArray files = new JSONArray();
            readDirRecursive(rootDir, "", files);

            JSObject result2 = new JSObject();
            result2.put("files", files);
            call.resolve(result2);
        } catch (Exception e) {
            call.reject("Error baca folder: " + e.getMessage());
        }
    }

    // Baca folder secara rekursif, kembalikan semua file sebagai base64 / text
    private void readDirRecursive(DocumentFile dir, String prefix, JSONArray out) throws Exception {
        for (DocumentFile file : dir.listFiles()) {
            if (file.isDirectory()) {
                readDirRecursive(file, prefix + file.getName() + "/", out);
            } else {
                String name = file.getName();
                String relPath = prefix + name;
                String mimeType = file.getType() != null ? file.getType() : "";

                boolean isText = mimeType.startsWith("text/")
                        || name.endsWith(".html") || name.endsWith(".htm")
                        || name.endsWith(".css") || name.endsWith(".js")
                        || name.endsWith(".json") || name.endsWith(".svg")
                        || name.endsWith(".xml");

                try {
                    InputStream is = getContext().getContentResolver().openInputStream(file.getUri());
                    byte[] bytes = readAllBytes(is);
                    is.close();

                    JSONObject entry = new JSONObject();
                    entry.put("path", relPath);
                    entry.put("name", name);

                    if (isText) {
                        entry.put("type", "text");
                        entry.put("content", new String(bytes, "UTF-8"));
                    } else {
                        entry.put("type", "base64");
                        entry.put("content", Base64.encodeToString(bytes, Base64.NO_WRAP));
                        entry.put("mime", mimeType);
                    }
                    out.put(entry);
                } catch (Exception e) {
                    // Skip file yang tidak bisa dibaca
                }
            }
        }
    }

    private byte[] readAllBytes(InputStream is) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[4096];
        int n;
        while ((n = is.read(chunk)) != -1) buffer.write(chunk, 0, n);
        return buffer.toByteArray();
    }
}
