[CmdletBinding()]
Param(
    [Alias("m","message")]
    [Parameter(Mandatory=$False,Position=1)]
    [string]$commitMessage
)

pelican content --output output --settings publishconf.py

# Write-Host "Done with pelican. Running copy."

# #Copy output from output folder to Git publishable folder
# $contentFiles = Get-ChildItem -Recurse -Path .\output\
# Get-ChildItem -Recurse -Path .\output\ | ForEach-Object {    
#     $file = $_		
	
#     if(($file -is [System.IO.DirectoryInfo])){ #Don't try to copy Directory objects.
#         return #Can't use continue, because I'm using ForEach-Object here.
#     }
		

#     $copyPath = $file.FullName.Replace("output", "pingzing.github.io")

#     #Don't copy files if they're identical. Check MD5 hashes to compare.
#     if (Test-Path $copyPath){
#         $md5 = New-Object -TypeName System.Security.Cryptography.MD5CryptoServiceProvider
#         $destHash = [System.BitConverter]::ToString(($md5.ComputeHash([System.IO.File]::ReadAllBytes($copyPath))))
#         $sourceHash = [System.BitConverter]::ToString(($md5.ComputeHash([System.IO.File]::ReadAllBytes($file.FullName))))
#         if($sourceHash -ne $destHash){
#             Write-Host "Source $($file.Name) was newer, copying."            
#             Copy-Item -Force $file.FullName $copyPath
#         }
#         else{
#             Write-Host "Skipping $($file.Name), already in the source dir."
#         }
#     }
#     else{
#         Write-Host "Source file $($file.Name) is new, copying."
#         New-Item -Force $copyPath #Create all the intermediate stuff if it doesn't exist
#         Copy-Item -Force $file.FullName $copyPath
#     }
# }

# Write-Host "Done copying items, running Git script."

# #Do the Git commit and git push.
# cd .\pingzing.github.io
# git add .\* -A
# if($commitMessage){
#     git commit -m \"$commitMessage\"
# }
# else{
#     git commit
# }
# git push

# cd ..
