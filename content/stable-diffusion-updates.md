Title: Stable Diffusion Updates
Date: 2022-09-18 14:30
Category: programming
Tags: programming, art, ai, ml, machine learning, stable diffusion, windows, amd, python, the robots are coming for us
Slug: stable-diffusion-updates
Authors: Neil McAlister
Summary: Improvements & updates on running Stable Diffusion on Windows with AMD GPUs
image: {photo}flutter-sumi.webp

***

#### This is a series!

Part one: [Running Stable Diffusion on Windows with an AMD GPU]({filename}/stable-diffusion-windows-amd.md)  
Part two: You're here!  

***

This is a follow-up to my previous post, [which explains how to get Stable Diffusion up and running on Windows for folks with an AMD GPU]({filename}/stable-diffusion-windows-amd.md).

Now that I've been playing around with it myself for a few days, and had some opportunities to chat with others likewise, I'd like to share a handful of updates and discoveries.

Namely:

- [An updated version of the Python script from the previous post, now with CLI args](#updated-python-script)
- [How to disable the safety checker (and why it sometimes causes black squares)](#disabling-the-safety-checker)
- [How to use different schedulers (e.g. the DDIM Scheduler)](#using-different-schedulers)

## Updated Python Script

Since the last post, I've cleaned up the Python script I've been using to invoke Stable Diffusion. The new version now allows for all the parameters to be passed in directly from the CLI--no need to edit the Python code by hand.

It adds one more requirement, a Pip package called "Click" that makes parsing CLI arguments very simple. Make sure you've got your virtual environment activated (`virtualenv/Scripts/Activate.ps1` or `virtualenv\Scripts\activate.bat`), and run:

```powershell
pip install click
```
... and you'll be ready to rock.

The updated Python script looks like this:

```python
import click
from diffusers import StableDiffusionOnnxPipeline
import numpy as np

@click.command()
@click.option("-p", "--prompt", required=True, type=str)
@click.option("-w", "--width", required=False, type=int, default=512)
@click.option("-h", "--height", required=False, type=int, default=512)
@click.option("-st", "--steps", required=False, type=int, default=25)
@click.option("-g", "--guidance-scale", required=False, type=float, default=7.5)
@click.option("-s", "--seed", required=False, type=int, default=None)
def run(
    prompt: str, 
    width: int, 
    height: int, 
    steps: int, 
    guidance_scale: float, 
    seed: int):

    pipe = StableDiffusionOnnxPipeline.from_pretrained(
        "./stable_diffusion_onnx", 
        provider="DmlExecutionProvider"
    )        
    
    # Generate our own latents so that we can provide a seed.
    seed = np.random.randint(np.iinfo(np.int32).max) if seed is None else seed
    latents = get_latents_from_seed(seed, width, height)

    print(f"\nUsing a seed of {seed}")
    image = pipe(prompt, height=height, width=width, num_inference_steps=steps, guidance_scale=guidance_scale, latents=latents).images[0]
    image.save("output.png")

def get_latents_from_seed(seed: int, width: int, height:int) -> np.ndarray:
    # 1 is batch size
    latents_shape = (1, 4, height // 8, width // 8)
    # Gotta use numpy instead of torch, because torch's randn() doesn't support DML
    rng = np.random.default_rng(seed)
    image_latents = rng.standard_normal(latents_shape).astype(np.float32)
    return image_latents

if __name__ == '__main__':
    run()
```

You can also find it [directly on GitHub](https://github.com/pingzing/stable-diffusion-playground/blob/main/text2img.py) if that's more your style.

It takes up to six parameters, only one of which is required:

- `-p` or `--prompt` is required, and is the text prompt you'd like to generate an image from.
- `-w` or `--width` is optional, defaults to 512, and **must be divisible by 8**.
- `-h` or `--height` is optional, defaults to 512, and **must be divisible by 8**
- `-st` or `--steps` is optional, defaults to 25, and is the number of iterations that will be performed on your prompt. Generally speaking, the higher this number is, the better quality the output.
- `-g` or `--guidance-scale` is optional, defaults to 7.5, and is how heavily the AI will weight your prompt versus being creative. `0` means that the AI will take a great deal of creative liberty. `20` or higher means that it attempt to rigidly adhere to the prompt. 
- `-s` or `--seed` is optional, defaults to a randomly generated 32-bit integer, and is the value used as a seed for generating randomness. The same prompt with the same seed will produce the same output.

With these modifications, you can now invoke the script like so:

```powershell
.\text2img.py -st 25 -p "A happy cat in a cyberpunk garden, cartoony style, digital painting, artstation, concept art, smooth, sharp focus, illustration, 8k"
```

[![An AI-generated picture of a large cat sitting in the middle of a futuristic intersection in a cyberpunk city.]({photo}cyberpunk-cat.png){loading='lazy'}]({static}/images/cyberpunk-cat.png "An AI-generated picture of a large cat sitting in the middle of a futuristic intersection in a cyberpunk city.")

Voila!

## Disabling the Safety Checker

You may have noticed that, sometimes, instead of generating something useful, your output image will just be a blank, black square. This isn't a bug, or an error--this is because Stable Diffusion's built in Safety Checker has detected content that is either NSFW, or otherwise objectionable. 

Now, if this you find that this is a useful feature, you could just detect it and print out a message, by doing something like this in the Python script:

```python
result = pipe(prompt, height=height, width=width, num_inference_steps=steps, guidance_scale=guidance_scale, latents=latents)
image = result.images[0]
is_nsfw = result.has_nsfw_concept
if is_nsfw: 
    print("Oh no! NSFW output detected!")

image.save("output.png")
```

...but for my use case, I'm only running this locally, and I don't really care if the AI occasionally generates some boobs. As an extra bonus, I've observed that if I disable the safety checker, I get a pretty significant speedup--somehwere between 20% and 40%, which usually shaves around a minute off my runtime. Not bad! So, if you'd like to disable the safety checker, all you have to do is add the following line after the declaration of `pipe`:

```python
# .... etc
pipe = StableDiffusionOnnxPipeline.from_pretrained(
    "./stable_diffusion_onnx", 
    provider="DmlExecutionProvider"
)    

# Add this line here!
pipe.safety_checker = lambda images, **kwargs: (images, [False] * len(images))
# ... etc
```

This is a tiny bit of a hack--we're messing around with the internals of `pipe`, which aren't really meant to be used externally, but dynamic languages gonna dynamic language. We replace the `safety_checker` member of `pipe` with what is basically a dummy function that unconditionally returns false. 

Now, no more black squares! Just beware, you now have a high likelihood of generating stuff you probably don't want to open up at work.

## Using Different Schedulers

Stable Diffusion can use a number of different sampling methods, which the `diffusers` package refers to as "schedulers" internally. The details of all of these are, frankly, not something I've investigated in great detail. The short version is that the characteristics of what they output, particularly at lower numbers of steps, tend to vary. For that reason, it can be useful to sometimes use a different scheduler. To use a different one, you have to construct it manually, and then pass it into the call to `from_pretrained()`. For example:

```python
# Up in your imports, add the DDIMScheduler from diffusers
import click
import diffusers import StableDiffusionOnnxPipeline, DDIMScheduler
import numpy as np

# Skipping a few lines for brevity...

# Constructing the DDIMScheduler scheduler manually:
scheduler = DDIMScheduler(beta_start=0.00085, beta_end=0.012, beta_schedule="scaled_linear", num_train_timesteps=1000)

# And telling the created pipe to use it:
    pipe = StableDiffusionOnnxPipeline.from_pretrained(
        "./stable_diffusion_onnx", 
        provider="DmlExecutionProvider",
        scheduler=scheduler
    )    
```

...however, if you run this as-is, it won't work. You'll get an arcane error along the lines of "expected np.int64, got np.int32".

Fixing this requires two things, the first of which is immensely hacky.

### The first thing
We need to go modify our local version of Stable Diffusion's Onnx pipeline. In order to find it, go look in `virtualenv\Lib\site-packages\diffusers\pipelines\stable_diffusion\` in whatever folder you have your virtual environment set up in.

Once in there, find `pipeline_stable_diffusion_onny.py`. That's our target here. Open it up, head down to line 133. We're going to change it from:

```python
# OLD
sample=latent_model_input, timestep=np.array([t]), encoder_hidden_states=text_embeddings
```

into...

```python
# NEW
sample=latent_model_input, timestep=np.array([t], dtype=np.int64), encoder_hidden_states=text_embeddings
```

We're now specifying the `dtype` in our call to `np.array()`.

Remember that this change won't survive if you recreate your virtual environment, reinstall the `diffusers` package, or update the `diffusers` package. I fully expect the need for this to go away in the next release of `diffusers` anyway.

### The second thing

Once the `diffusers` package has been modified, you need to make a tiny change to how we declare our scheduler. Let's reuse our DDIM scheduler example.

Instead of doing this:
```python
# Wrong
scheduler = DDIMScheduler(beta_start=0.00085, beta_end=0.012, beta_schedule="scaled_linear", num_train_timesteps=1000)
```

...do this:

```python
# Right
scheduler = DDIMScheduler(beta_start=0.00085, beta_end=0.012, beta_schedule="scaled_linear", num_train_timesteps=1000, tensor_format="np")
```

(I _believe_ the reason for this is because we're using Onnx and not Torch, we need to tell the scheduler to use Numpy's tensor format, and not Torch's. I think. I'm no expert on this.)

Once you've done Thing One and Thing Two, you should now be able to use the other schedulers. Examples of constructing them can be found in [HuggingFace's `diffusers` repository](https://github.com/huggingface/diffusers/tree/main/src/diffusers/pipelines/stable_diffusion).

For an example of what all this looks like when put together, take a look at [the version I have in GitHub](https://github.com/pingzing/stable-diffusion-playground/blob/main/text2img.py).

Disclaimer: I've only tried the DDIM scheduler myself--my GPU is a touch under-powered, and I mostly just wanted to run something that would generate acceptable results in fewer steps. If you have any success in getting the others running, feel free to leave a comment!

## Wrapping Up

I think that's all I've got for this one. A CLI-ified version of the script from last time, disabling the safety checker to win some speed (and possible salacious output), and enabling other schedulers when using the Onnx pipeline. Not bad for a few days of tinkering. 

Some additional thanks to ponut64 in the comments of the last post, and AzuriteCoin for confirming the Onnx scheduler fix.

One extra thought: one thing I might do in the future is enhance my little CLI script to allow the caller to choose which scheduler to use. I'll have to play around with that a bit more, but watch this space if you're interete in such a thing (and don't just hack it together yourself).

Thanks for reading! As ever, I can be found on GitHub as [pingzing](https://github.com/pingzing/) and Twitter as [@pingzingy](https://twitter.com/pingzingy). Happy generating!



[![Creative Commons BY badge]({static}/images/cc-by.png)](https://creativecommons.org/licenses/by/4.0/ "This work is licensed under a Creative Commons Attribution 4.0 International License.")
_The text of this blog post is licensed under a Creative Commons Attribution 4.0 International License._ 