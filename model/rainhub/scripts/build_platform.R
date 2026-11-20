# Rebuild outputs/rainhub-model.json (the file the Aquavelle web app reads) without re-running the models.
# Needs outputs/real_result.rds from run_real.R.
for (f in sort(list.files("R", pattern = "\\.R$", full.names = TRUE))) source(f)
x <- readRDS("outputs/real_result.rds")
export_platform(x$res, x$d, "outputs/rainhub-model.json")
# Inside the Aquavelle package, also refresh the copy the web app serves.
if (dir.exists("../../web/public/data")) file.copy("outputs/rainhub-model.json", "../../web/public/data/rainhub-model.json", overwrite = TRUE)
message("Wrote outputs/rainhub-model.json. Copy it to the platform's public/data/ folder.")
